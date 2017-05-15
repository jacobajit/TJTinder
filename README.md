# TJTinder
Tinder-like app to help TJ kids find new connections/matches. Does he/she like me? What if it was possible to find out without any risk? Imagine how much easier homecoming would be! Using TJHSST's Ion API, TJTinder authenticates current students and suggests random matches from the student directory. Stores likes and matches in Firebase. Built with Polymer Web Components.

## Server Install
You will need to define the following environment variables:
* CLIENT_ID - Ion OAuth2 client ID
* CLIENT_SECRET - Ion OAuth2 client secret
* REDIRECT_URI - URL to redirect to for Ion OAuth2
* FIREBASE_AUTH - Firebase certificate in JSON format
* FIREBASE_SECRET - Firebase database secret (legacy)

To run the server, install Heroku, add the environment variables to `.env`, and run:

```bash
npm install
heroku local
```
