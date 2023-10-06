# Server

Note: You may need to make some tweaks to the codebase to get it up and running / eliminate errors.

## Setup

1. clone the repo
2. `cd server && yarn`
3. Make a `.env` file and place it into the root of the repo. Add your own keys:
```
# we use mongodb for the database. create an atlas database and put the URI in here.
MONGO_URI=""

# firebase keys
PROJECT_ID=""
PRIVATE_KEY_ID=""
PRIVATE_KEY=""
CLIENT_EMAIL=""
CLIENT_ID=""
CLIENT_CERT_URL=""

# this should be a random string
ENCRYPT_DECRYPT_KEY=""

SEGMENT_WRITE_KEY="include_if_you_want_to_track_company_usage"
```
4. `npm run dev` starts the server in debug mode
5. `npm run test` runs all tests using jest

## Deployment

It should be relatively easy to figure out how to deploy this NodeJS app on Render or Heroku.

## License

Logtree by Andy Lebowitz is licensed under Attribution-NonCommercial 4.0 International. [See details here.](https://creativecommons.org/licenses/by-nc/4.0/?ref=chooser-v1)
