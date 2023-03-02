# Postgres Q&A

![Screen_Recording_2023-03-01_at_17_58_11_AdobeExpress (1)](https://user-images.githubusercontent.com/13738772/222217144-2c741b78-7a27-44ed-be95-6a3ee3e42cbe.gif)

Postgres Q&A is a project that demonstrates how to use word embeddings and Postgres to build a chatbot. The chatbot is implemented using Vercel Edge Functions and the @neondatabase/serverless driver, and relies on OpenAI's GPT-3 API to generate responses.

## Getting started

To get started with this project, you'll need to have:

- A Neon account, and project.
- an API key for the OpenAI GPT-3 API, which you can obtain from https://openai.com/.

Once you have the prerequisites installed, follow these steps to get the project up and running:

Clone the repository:

```bash
git clone https://github.com/neondatabase/postgres-qa.git
cd ask-postgres
```

## Prepare the data

### Import embeddings to Neon

This section is derived from OpenAI’s cookbook example. You can use the Python code here to build a web crawler and extract the text you need to create embeddings. We’ve already created the text files based on https://www.postgresql.org/docs/, which you can find in `data/text` directory.

To get started, move to the `data` directory create a new environment and install the dependencies:

```bash
cd data
python -m venv env
source env/bin/activate
pip install -r requirements.txt
```

Import the schema to your database:

```bash
psql <database-url> -f database.sql
```

Let’s now add `DATABASE_URL` and `OPENAI_API_KEY` to our environment variables:

```bash
export DATABASE_URL=<YOUR_NEON_CONEECTION_STRING> OPENAI_API_KEY=<YOUR_OPENAI_API_KEY>
```

Run `main.py` to import the emebbeding to your Neon database:

```bash
python main.py
```

Relax and grab a cup of coffee as this section might take 10min to process!

Expcted result:

```bash
Saving to CSV...
Loading tokenizer...
Embedding text...
Connecting to database...
Done!
```

Install the project dependencies:

```bash
cd app
npm install
```

Create a .env file

```bash
touch .env.local
```

Set the following environment variables:

```
OPENAI_API_KEY= Your OpenAI API key.
DATABASE_URL= The connection URL for your Neon database.
```

Start the server:

```bash
npm run dev
```

## Contributing

We welcome contributions to this project! If you find a bug, have a suggestion, or want to contribute code, please open an issue or pull request on the GitHub repository.

## License

This project is licensed under the MIT License. See the LICENSE file for more information.
