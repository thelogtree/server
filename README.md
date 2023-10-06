# Server

Note: You may need to make some tweaks to the codebase to get it up and running / eliminate errors. Also, the codebase is relatively messy right now. There is a lot of code still in the repo from a prior feature. Please ignore irrelevant code.

## Privacy

Because you are using your own API keys, hosting it on your own servers, and using your own database, everything can only be seen and used by you and people in your organization. There is no code that lets me monitor the activity of people using this product.

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

6. Once you're hosting the server and web repo, you can call this POST endpoint below which is currently commented out. You can do this through Postman when running the server locally which can be done with the command in step 4. Be sure to comment this line out again once you have successfully called it once. You can see what the body of the route should look like by going to the createOrganization Joi schema. The url you call will look something like `https://your_server_url.com/api/organization`.
```
// router.post(
//   "/",
//   validateRequestAgainstSchemas({
//     bodySchema: OrganizationSchemas.createOrganization,
//   }),
//   OrganizationController.createOrganization
// );
```

7. Once you have successfully created an organization for your team, you should be able to see it in MongoDB. This endpoint also creates the first account in the organization which you can login with on the frontend. Once you're in with this account, you'll be able to invite more members to your team from within the hosted web app, no coding or terminal needed.

## Deployment

It should be relatively easy to figure out how to deploy this NodeJS app on Render or Heroku. Remember to add your .env keys to the service you're hosting this on.

## License

Logtree by Andy Lebowitz is licensed under Attribution-NonCommercial 4.0 International. [See details here.](https://creativecommons.org/licenses/by-nc/4.0/?ref=chooser-v1)
