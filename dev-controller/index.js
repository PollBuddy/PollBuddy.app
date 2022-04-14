const express = require('express')
const os = require('os')
const kubernetes = require('./kubernetes')
const dotenv = require('dotenv').config()


const app = express()

// Express Session
const expressSession = require("express-session");
const MemoryStore = require('memorystore')(expressSession)
app.use(expressSession({
  cookie: {
    maxAge: 2629800000
  },
  name: "pollbuddy_dev_session",
  secret: process.env["EXPRESS_SESSION_SECRET"],
  secure: true,
  rolling: true,
  resave: false,
  saveUninitialized: true,
  store: new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  }),
}));

app.set('view engine', 'pug')

function initSession(req) {
  if(req.session.githubAuthorized === undefined) {
    req.session.githubAuthorized = false;
  }
  if(req.session.pollbuddyMember === undefined) {
    req.session.pollbuddyMember = false;
  }
}

app.get('/', async (req, res) => {
  initSession(req);
  /*await getDevInstances(function(data) {
    // Convert dev instances into something useful

    return res.render('index', { title: 'Hey', message: 'Hello there!', githubAuthorized: req.session.githubAuthorized, pollbuddyMember: req.session.pollbuddyMember, devInstances: data });
  });
  listDeployments(function(){});*/
  await listServices(function(data){
    // Convert dev instance services into something useful to display
    for(let i = 0; i < data.length; i++) {
      console.log(data[i].pods[0]);
    }

    console.log("Request done");
    return res.render('index', { title: 'Hey', message: 'Hello there!', githubAuthorized: req.session.githubAuthorized, pollbuddyMember: req.session.pollbuddyMember, devInstances: data });

  });

});

function getDevInstances(callback) {
  kubernetes.listPods(function(data) {
    callback(data.items);
  });
}

// GitHub oAuth
const axios = require('axios');
const {listDeployments, listServices} = require("./kubernetes");
app.get('/github-auth', (req, res) => {
  res.redirect(`https://github.com/login/oauth/authorize?client_id=${process.env["GITHUB_CLIENT_ID"]}&scope=read:org`);
});

app.get('/github-oauth-callback', async (req, res) => {
  const body = {
    client_id: process.env["GITHUB_CLIENT_ID"],
    client_secret: process.env["GITHUB_CLIENT_SECRET"],
    code: req.query.code
  };
  const opts = {headers: {accept: 'application/json'}};
  await axios.post(`https://github.com/login/oauth/access_token`, body, opts).then(result => result.data['access_token']).then(async _token => {
    req.session.github_access_token = _token;
    req.session.githubAuthorized = true;

    // Now get their organization info
    try {
      await axios.get('https://api.github.com/user/memberships/orgs', {headers: {authorization: `Token ${req.session.github_access_token}`}}).then((result) => {
        for (let i = 0; i < result.data.length; i++) {
          let org = result.data[i]
          if (org.organization.login === "PollBuddy" && org.state === "active") {
            req.session.pollbuddyMember = true;
            return res.redirect("/");
          }
        }
        req.session.pollbuddyMember = false;
        return res.redirect("/");
      });
    } catch (e) {
      console.log(e);
      return res.send("An error occurred, please try again");
    }

  }).catch(err => res.status(500).json({message: err.message}));
});





const port = 3000
app.listen(port, () => console.log(`listening on port ${port}`))