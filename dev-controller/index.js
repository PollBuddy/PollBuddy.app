const express = require('express')
const app = express()
const os = require('os')
const kubernetes = require('./kubernetes')
const dotenv = require('dotenv').config()
const logger = require("morgan");

const {listServices, startDevInstance, stopDevInstance, deleteDevInstance, deployDevInstance, listDevInstances,
  deployMaster
} = require("./kubernetes");

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

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.set('view engine', 'pug')

// Middleware to set up the session
app.use((req, res, next) => {
  if(req.session.githubAuthorized === undefined) {
    req.session.githubAuthorized = false;
  }
  if(req.session.pollbuddyMember === undefined) {
    req.session.pollbuddyMember = false;
  }
  next();
});

app.get('/', async (req, res) => {
  await listDevInstances(function(data){
    // TODO: Sort the services by creation timestamp
    return res.render('index', { title: 'Hey', message: 'Hello there!', githubAuthorized: req.session.githubAuthorized, pollbuddyMember: req.session.pollbuddyMember, devInstances: data });
  });
});

app.get('/api', async (req, res) => {
  return res.json({"ok": true});
});

// Controlling instances
app.get('/api/deployment', async (req, res) => {
  return res.json({"ok": true});
});

app.post('/api/deployment/start', async (req, res) => {
  if(req.session.githubAuthorized) {
    console.log("Got request to start an instance");
    await startDevInstance(req.body.dev_instance_type, req.body.dev_instance_id, function (result) {
      if(result) {
        return res.json({"ok": true});
      } else {
        return res.status(500).json({"ok": false});
      }
    });
  } else {
    return res.status(401).json({"ok": false});
  }
});

app.post('/api/deployment/stop', async (req, res) => {
  if(req.session.githubAuthorized) {
    await stopDevInstance(req.body.dev_instance_type, req.body.dev_instance_id, function(result){
      if(result) {
        return res.json({"ok": true});
      } else {
        return res.status(500).json({"ok": false});
      }
    });
  } else {
    return res.status(401).json({"ok": false});
  }
});

app.post('/api/deployment/delete', async (req, res) => {
  if(req.session.githubAuthorized || req.body.key === process.env["CICD_KEY"]) {
    console.log("Got request to delete an instance");
    await deleteDevInstance(req.body.dev_instance_type, req.body.dev_instance_id, function(result){
      if(result) {
        return res.json({"ok": true});
      } else {
        return res.status(500).json({"ok": false});
      }
    });
  } else {
    return res.status(401).json({"ok": false});
  }
});

// From https://github.com/actions/checkout/issues/58#issuecomment-576589498
function parsePullRequestId(githubRef) {
  const result = /refs\/pull\/(\d+)\/merge/g.exec(githubRef);
  if (!result) throw new Error("Reference not found.");
  const [, pullRequestId] = result;
  return pullRequestId;
}

app.post('/api/deployment/new', async (req, res) => {
  if(req.session.githubAuthorized || req.body.key === process.env["CICD_KEY"]) {
    console.log("Got request to create a new instance");
    // Parse the ID if necessary
    let id;
    if(req.body.dev_instance_type !== undefined && req.body.dev_instance_id !== undefined) {
      // Must be a dev instance deployment
      if (req.body.dev_instance_type === "commit") {
        id = req.body.dev_instance_id;
      } else if (req.body.dev_instance_type === "pr") {
        if(req.body.dev_instance_id.includes("refs")) {
          try {
            id = parsePullRequestId(req.body.dev_instance_id);
          } catch (e) {
            console.log("Invalid PR ID received: " + req.body.dev_instance_id);
            return res.status(400).json({"ok": false});
          }
        } else {
          id = req.body.dev_instance_id;
        }

      } else {
        return res.status(400).json({"ok": false});
      }

      // Start the deployment
      await deployDevInstance(req.body.dev_instance_type, id, function (result) {
        if (result) {
          return res.json({"ok": true, "deploy_link": "https://dev-" + id + ".pollbuddy.app/"});
        } else {
          return res.status(500).json({"ok": false});
        }
      });
    } else {
      // Must be a master deploy
      // Start the deployment
      await deployMaster(function (result) {
        if (result) {
          return res.json({"ok": true, "deploy_link": "https://pollbuddy.app/"});
        } else {
          return res.status(500).json({"ok": false});
        }
      });
    }
  } else {
    return res.status(401).json({"ok": false});
  }
});

// GitHub oAuth
const axios = require('axios');
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
          if (org.organization_url === "https://api.github.com/orgs/PollBuddy" && org.state === "active") {
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