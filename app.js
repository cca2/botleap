/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var express = require('express'); // app server
var engines = require('consolidate')
var path = require('path')

var request = require('request') //app request
var slackBot = require('./slack-bot')

var bodyParser = require('body-parser'); // parser for post requests
var Conversation = require('watson-developer-cloud/conversation/v1'); // watson sdk

var app = express();

// Bootstrap application settings
// app.use(express.static(__dirname)); // load UI from public folder
app.use(express.static(path.join(__dirname + '/public/static')))

app.engine('html', engines.mustache)
app.set('views', path.join(__dirname, 'public'))
app.set('view engine', 'html')


app.use(bodyParser.json());

// app.get('/', (req, res) => {
//   res.sendFile(__dirname + './public/imperial/index.html')
// })

app.get('/', function(req, res) {
  console.log('>>> 800 <<<')
  res.render('index.html', {startupName: 'Porquin', feedbacks: [{text: 'Isto é apenas um teste e nada mais'}, {text: 'teste1'}], test: 'teste'})
})

app.get('/auth/redirect', (req, res) => {
  console.log('>>> /auth/redirect')
  var options = {
      uri: 'https://slack.com/api/oauth.access?code='
          +req.query.code+
          '&client_id='+process.env.CLIENT_ID+
          '&client_secret='+process.env.CLIENT_SECRET+
          '&redirect_uri='+process.env.REDIRECT_URI,
      method: 'GET'
  }
  request(options, (error, response, body) => {
      var JSONresponse = JSON.parse(body)
      if (!JSONresponse.ok){
          console.log(JSONresponse)          
          res.send("Error encountered: \n"+JSON.stringify(JSONresponse)).status(200).end()
      }else{
          console.log(JSONresponse)
          var teamID = JSONresponse.team_id
          var slackBotToken = JSONresponse.bot.bot_access_token
          slackBot.registerSlackBotToken(teamID, slackBotToken)
          res.send("Success!")
      }
  })
})

console.log('>>>> APP.JS <<<<')

module.exports = app;
