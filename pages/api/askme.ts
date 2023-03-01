import { Client } from '@neondatabase/serverless';
import {
  createParser,
  ParsedEvent,
  ReconnectInterval,
} from 'eventsource-parser';

export interface CompletionParams {
  model: string;
  prompt: string;
  temperature: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
  max_tokens: number;
  stream: boolean;
  n: number;
}
const max_tokens = 1700;

export const config = {
  runtime: 'edge',
};

export default async (req: Request) => {
  const { query } = (await req.json()) as {
    query?: string;
  };

  if (!query) {
    return new Response('No prompt in the request', { status: 400 });
  }

  let prompt = '';

  try {
    // Create context from embeddings
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      method: 'POST',
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: query,
      }),
    });

    const responseJson = await response.json();
    const q_embeddings = responseJson['data'][0]['embedding'];
    const q_embeddings_str = q_embeddings.toString().replace(/\.\.\./g, '');

    // Query the database for the context
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const insertQuery = `
      SELECT text
      FROM (
        SELECT text, n_tokens, embeddings,
        (embeddings <=> '[${q_embeddings_str}]') AS distances,
        SUM(n_tokens) OVER (ORDER BY (embeddings <=> '[${q_embeddings_str}]')) AS cum_n_tokens
        FROM documents
        ) subquery
      WHERE cum_n_tokens <= $1
      ORDER BY distances ASC;
      `;

    const queryParams = [max_tokens];
    console.log('Querying database...');
    const { rows } = await client.query(insertQuery, queryParams);
    await client.end();
    const context = rows.reduce((acc, cur) => {
      return acc + cur.text;
    }, '');

    // Checking prompt intent
    prompt = `You are an enthusiastic Postgres developer who loves Neon database and has a passion for helping answering developers might have. Answer the question asked by developers based on the context below. If the question can't be answered based on the context, say "Sorry :( I don't know."\n\nContext: ${context}\n\n---\n\nQuestion: ${query}\nAnswer:`;
  } catch (e) {
    // if there is an error, return the error message
    prompt = `write an error message to explain why the query errored.--\n\Error: ${JSON.stringify(
      e
    )}\nAnswer:`;
  } finally {
    // return the stream
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    let counter = 0;

    const res = await fetch('https://api.openai.com/v1/completions', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ''}`,
      },
      method: 'POST',
      body: JSON.stringify({
        model: 'text-davinci-003',
        prompt,
        temperature: 0.5,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        max_tokens: 1700,
        stream: true,
        n: 1,
      }),
    });

    const stream = new ReadableStream({
      async start(controller) {
        // callback
        function onParse(event: ParsedEvent | ReconnectInterval) {
          if (event.type === 'event') {
            const data = event.data;
            // https://beta.openai.com/docs/api-reference/completions/create#completions/create-stream
            if (data === '[DONE]') {
              controller.close();
              return;
            }
            try {
              const json = JSON.parse(data);
              const text = json.choices[0].text;
              if (counter < 2 && (text.match(/\n/) || []).length) {
                // this is a prefix character (i.e., "\n\n"), do nothing
                return;
              }
              const queue = encoder.encode(text);
              controller.enqueue(queue);
              counter++;
            } catch (e) {
              // maybe parse error
              controller.error(e);
            }
          }
        }

        // stream response (SSE) from OpenAI may be fragmented into multiple chunks
        // this ensures we properly read chunks and invoke an event for each SSE event stream
        const parser = createParser(onParse);
        // https://web.dev/streams/#asynchronous-iteration
        for await (const chunk of res.body as any) {
          parser.feed(decoder.decode(chunk));
        }
      },
    });
    return new Response(stream);
  }
};
