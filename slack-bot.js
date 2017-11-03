var port = process.env.PORT || process.env.VCAP_APP_PORT || 3000;

var RtmClient = require('@slack/client').RtmClient;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;

var WebClient = require('@slack/client').WebClient;

var bot_token = process.env.SLACK_BOT_TOKEN || '';
var bot_name = 'leap'

// The SlackBot module is designed to handle all interactions with the server
// Initialize Firebase
// TODO: Replace with your project's customized code snippet
var firebase = require('firebase');
// var config = {
//   databaseURL: "https://foresight-f9060.firebaseio.com",
// };
// firebase.initializeApp(config);

var SlackBot = (function() {

  // Publicly accessible methods defined
  return {
    activateSlackBots: function() {
      var slackBotTokens = []
      var slackTeamsRef = firebase.database().ref('slack_teams')
      return slackTeamsRef.once('value', function(snapshot) {
        var teams = snapshot.val()
        console.log('>>> 700 <<<')
        Object.keys(teams).forEach(function(key) {
          var team = teams[key]
          if (team.slackBotToken) {
            slackBotTokens.push(team.slackBotToken)
          }
        })
      }).then(function() {
        return slackBotTokens
      })
    },

    activateSlackBot: function(teamID, slackBotToken) {
      console.log('>>> 800')
      var updates = {}

      updates['slack_teams/' + teamID + '/slackBotToken'] = slackBotToken
      return firebase.database().ref().update(updates).then(function() {
        console.log('>>> 810 <<<')
        })
    }

  };

}());


module.exports = SlackBot
