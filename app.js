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

// Initialize Firebase
// TODO: Replace with your project's customized code snippet
var firebase = require('firebase');
var config = {
  // apiKey: "<API_KEY>",
  // authDomain: "<PROJECT_ID>.firebaseapp.com",
  databaseURL: "https://foresight-f9060.firebaseio.com",
};
firebase.initializeApp(config);

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

function fetchCommentsByStartupId(teamId, startupId) {
  console.log(startupId)
  const startupRef = firebase.database().ref('startups/' + startupId);
  var authorsDict = {};
  var authorsList = [] ;
  var startup = null;
  return startupRef.once('value').then((snapshot) => {
    console.log('>>> 300')
    startup = snapshot.val();
    console.log(startup);

    if (startup) {
      const feedbacks = startup.feedbacks;
      Object.keys(feedbacks).forEach(function(date) {
        const feedbacksByDate = feedbacks[date];
        Object.keys(feedbacksByDate).forEach(function(authorID) {
          authorsList.push(authorID);
        })
      })

      var promises = [];
      var authorsRef = firebase.database().ref('slack_teams/' + teamId + '/members');
      return authorsRef.once('value', function(authorsSnapshot) {
        console.log('>>> 400 <<<')
        var authors = authorsSnapshot.val();
        console.log(authors);
        authorsList.forEach(function(authorID) {
          console.log(authorID)
          if (authorID != 'date') {
            if (authors[authorID])
              authorsDict[authorID] = authors[authorID].name;
          }
        })
        console.log('>>> 410 <<<');
        console.log(authorsDict);
      }).then(function() {
        console.log('>>> 420 <<<');
        if (startup) {
        console.log('>>> 430 <<<');
        console.log(startup)      
          return {startup: startup, authorsDict: authorsDict};
        }else {
        console.log('>>> 440 <<<');
          return null;
        }
      });      
    }
  });
}

app.get('/', function(req, res) {
  console.log('>>> 800 <<<')
  // console.log(req)
  var slack_team_id = req.query.slack_team_id
  var startup_id = req.query.startup_id
  console.log(slack_team_id)
  console.log(startup_id)
  fetchCommentsByStartupId(slack_team_id, startup_id).then(function(result) {
    var feedbacks = result.startup.feedbacks
    var commentsList = []
    // var htmlCommentsList = []
    var dayComments = {}
    var page = this

    //Ordenar os comentários de forma decrescente de data
    var datesSorted = Object.keys(feedbacks).sort(function(a,b) {
      var dateA = new Date(feedbacks[a].date)
      var dateB = new Date(feedbacks[b].date)
      return dateB - dateA
    })

    datesSorted.forEach(function(key) {
      var dComments = feedbacks[key]
      var dayComments = {
        // date: new Date(feedbacks[key].date).toLocaleDateString('pt-BR'),
        date: new Date(feedbacks[key].date).toString(),
        compliments: [],
        questions: [],
        critics: [],
        suggestions: []
      }

      Object.keys(dComments.authors).forEach(function(author) {
        var authorComments = dComments.authors[author]
        Object.keys(authorComments).forEach(function(commentKey) {
          var authorComment = authorComments[commentKey]

          if (authorComment.topClass == 'ELOGIO')
            dayComments.compliments.push({text: authorComment.text, author:author, key: commentKey})
          if (authorComment.topClass == 'CRITICA')
            dayComments.critics.push({text: authorComment.text, author:author, key: commentKey})
          if (authorComment.topClass == 'PERGUNTA')
            dayComments.questions.push({text: authorComment.text, author:author, key: commentKey})
          if (authorComment.topClass == 'SUGESTAO')
            dayComments.suggestions.push({text: authorComment.text, author:author, key: commentKey})
        })
      })
      commentsList.push(dayComments)
    })

    res.render('index.html', {startupName: result.startup.name, feedbacks: commentsList})
  })  
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
