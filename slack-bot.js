// var port = process.env.PORT || process.env.VCAP_APP_PORT || 3000;

var RtmClient = require('@slack/client').RtmClient;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;

var WebClient = require('@slack/client').WebClient;

var bot_token = process.env.SLACK_BOT_TOKEN || '';
var bot_name = 'leap'

var activeTokens = {}

// The SlackBot module is designed to handle all interactions with the server
// Initialize Firebase
// TODO: Replace with your project's customized code snippet
var firebase = require('firebase')
// var config = {
//   databaseURL: "https://foresight-f9060.firebaseio.com",
// };
// firebase.initializeApp(config);

var Leap = require('./leap-conversation')


var SlackBot = (function() {

  // Publicly accessible methods defined
  return {
    activateSlackBot: activateSlackBot,

    monitorStartups: function() {
      Leap.monitorNewStartups()
    },

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
            activeTokens[team.slackBotToken] = {active: false}
          }
        })
      }).then(function() {
        return slackBotTokens
      })
    },

    registerSlackBotToken: function(teamID, slackBotToken) {
      var updates = {}

      updates['slack_teams/' + teamID + '/slackBotToken'] = slackBotToken
      return (
        firebase.database().ref().update(updates).then(function() {
          console.log('>>> 810 <<<')
          //Aqui: está ativando mais de uma vez quando não é necessário
          if (!activeTokens[slackBotToken]) {
            activeTokens[slackBotToken] = {active: false}
          }
          activateSlackBot(slackBotToken)
        })
      )
    },
  }

  function activateSlackBot(token) {

    if (!activeTokens[token] || !activeTokens[token].active) {
      activeTokens[token].active = true

      var rtm = new RtmClient(token)
      var web = new WebClient(token)

      let channel;


      let context = {};
      let contextsByUserId = {}

      let slackTeamId

      // The client will emit an RTM.AUTHENTICATED event on successful connection, with the `rtm.start` payload
      rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (rtmStartData) => {
        for (const c of rtmStartData.channels) {
          console.log ('channel: ', c.name);
          if (c.is_member && c.name === rtmStartData.self.name) { 
            channel = c.id 
            console.log('channel == ', channel);
          }
        }
        console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name}, but not yet connected to a channel`);
      });

      rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {
        var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
        // var payload = {
        //   workspace_id: workspace,
        //   context: {},
        //   input: {'text': message.text}
        // };

        // Send the input to the conversation service
        var isBotChannel = false
        if (message.channel.startsWith('D'))
          isBotChannel = true

        if ((message.username != 'projetaobot' && message.username != 'leapbot' && message.username != 'leapacademy') && isBotChannel) {
          console.log('>>> 800')
          console.log(message)

          var userId = message.user

          if (!Leap.conversationsByUserId[userId]) {
            Leap.newConversation(userId)
          }

          console.log(Leap.conversationsByUserId)

          if (!contextsByUserId[userId]) {
            contextsByUserId[userId] = {}
          }

          // Leap.sendMessage(userId, message.text, context, function(err, response) {
            Leap.sendMessage(userId, message.text, contextsByUserId[userId], function(err, response) {
              if (err) {
                console.log('error:', err);
              }else {
                context = response.context;
                contextsByUserId[userId] = context
                console.log('>>> 100 <<<')
                if (!context.action || context.action == '') {
                  console.log('>>> 110 <<<')
                  console.log(message)
                  web.chat.postMessage(message.channel, response.output.text[0], true, function(err, messageResponse) {
                    if (err) {

                    }else {

                    }
                  })
                }else if (context.action == 'action_test') {
                  context.action =  ''
                  // Leap.downloadCSVFile()
                  // Leap.test()
                  web.chat.postMessage(message.channel, response.output.text[0], true, function(err, messageResponse) {
                    if (err) {

                    }else {

                    }
                  })
                }else if (context.action == 'action_update_startup_name'){
                  context.action = ''
                  var newStartupName = context.newStartupName.trim()
                  var startupName = context.startupName
                  var result = Leap.updateStartupName(slackTeamId, startupName, newStartupName)
                  if (result) {
                    result.then(function() {
                      Leap.sendMessage(userId, '', context, function(err, response) {
                        // web.chat.postMessage(message.channel, response.output.text[0], true, function(err, message) {
                        //   if (err) {

                        //   }else {

                        //   }
                        // })
                      })
                    })
                  }
                  web.chat.postMessage(message.channel, response.output.text[0], true, function(err, messageResponse) {
                    if (err) {

                    }else {

                    }
                  })
                }else if (context.action == 'action_include_member_in_startup') {
                  context.action = ''
                  var memberToAddId = context.memberToAddId
                  var startupName = context.startupName
                  if (memberToAddId) {
                    memberToAddId = memberToAddId.substring(2,11)
                    Leap.includeMemberInStartup(slackTeamId, startupName, memberToAddId).then(function() {
                      web.chat.postMessage(message.channel, response.output.text[0], true, function(err, messageResponse) {
                        if (err) {

                        }else {

                        }
                      })                                                  
                    })
                  }
                }else if (context.action == 'action_remove_member_from_startup') {
                  context.action = ''
                  var memberToRemoveID = context.memberToRemoveID
                  var startupName = context.startupName
                  if (memberToRemoveID) {
                    memberToRemoveID = memberToRemoveID.substring(2,11)
                    var memberName = Leap.getMemberNameById(slackTeamId, memberToRemoveID)
                    Leap.removeMemberFromStartup(slackTeamId, startupName, memberToRemoveID).then(function() {
                      var text = response.output.text[0].replace('MEMBER_NAME', memberName)
                      web.chat.postMessage(message.channel, text, true, function(err, messageResponse) {
                        if (err) {

                        }else {

                        }
                      })                                                  
                    })
                  }
                }else if (context.action == 'action_show_startup_evaluation') {
                  context.action = ''
                  web.chat.postMessage(message.channel, response.output.text[0], true, function(err, messageResponse) {
                    if (err) {

                    }else {

                    }
                  })              
                }else if (context.action == 'action_list_entrepreneurs') {
                  context.action = ''

                  web.team.info(function(err, info) {
                    if (err) {
                      console.log('erro:', err);
                    }else {
                      console.log('team info: ', info);
                      slackTeamId = info.team.id
                      web.users.list(function(err, list) {
                        if (err) {

                        }else {
                          var slackMembersDict = {}
                          var members = list.members
                            var attachments = []
                          for (var i = 0; i < members.length; i++) {
                            if (members[i].profile.email) {
                              var member = {
                                name: members[i].profile.real_name,
                                slackName: members[i].profile.display_name,
                                email: members[i].profile.email
                              }     
                              slackMembersDict[members[i].id] = member
                                  var attachment = {
                                      "title": member.name,
                                      "text": member.email,
                                      "color": "#7CD197"
                                  }
                                  attachments.push(attachment)                        
                            }
                          }

                          web.chat.postMessage(message.channel, response.output.text[0], {as_user: false, attachments: attachments}, function(err, messageResponse) {
                            if (err) {
                              console.log(err)
                            }else {

                            }
                          })              
                        }
                      })
                    }
                  });
                }else if (context.action == 'action_list_startups') {
                  context.action = ''
                  var startupsList = Leap.listStartups(slackTeamId)
                  var attachments = []
                  for (var i = 0; i < startupsList.length; i++) {
                      var attachment = {
                          "title": startupsList[i].name,
                          //Aqui: precisa melhorar a descrição das startups baseada no opening statement
                          // "text": 'Descrição',
                          "color": "#7CD197"
                      }
                      attachments.push(attachment)                                
                  }
                  web.chat.postMessage(message.channel, response.output.text[0], {as_user: false, attachments: attachments}, function(err, messageResponse) {
                    if (err) {
                      console.log(err)
                    }else {

                    }
                  })              
                }else if (context.action == 'action_create_startup') {
                  context.action = ''
                  var startupName = context.startupName.trim()
                  Leap.createStartup(slackTeamId, startupName, message.user).then(function(startup) {
                    web.chat.postMessage(message.channel, response.output.text[0], true, function(err, messageResponse) {
                      if (err) {

                      }else {

                      }
                    })                            
                  })
                }else if (context.action == 'action_save_comments') {
                  context.action = ''           
                  var commentsSavedPromise = Leap.saveAndClassifyComments(context.startupName, message.user, context.commentsList)
                  // var commentsKey = Leap.addNewComments(context.startupName, message.user, context.commentsList)
                  // if (commentsKey) {

                    commentsSavedPromise.then(function(commentsSaved) {
                      web.chat.postMessage(message.channel, response.output.text[0], true, function(err, messageResponse) {
                        if (err) {

                        }else {
                          Leap.appendCommentsToGoogleSpreadsheet(commentsSaved)
                        }
                      })              
                    })
                  // }
                }else if (context.action == 'action_classify_comments') {
                  context.action = ''
                  // Leap.classifyComments(context.startupName).then(function(commentsList) {
                  Leap.listFeedbacks(context.startupName).then(function(commentsList) {
                    var attachments = []

                    if (commentsList.length == 0) {
                        var attachment = {
                          "title": "Não há comentários sobre a " + context.startupName,
                            "color": "#181818"
                        }
                        attachments.push(attachment)
                    }else {
                        var attachment = {
                          // "title": "Mais detalhes pode ser vistos em http://localhost:8080/comments/" + slackTeamId + "/" + Leap.getStartupIdByName(context.startupName),
                          "title": "Mais detalhes podem ser vistos em https://botleap.herokuapp.com/?slack_team_id=" + slackTeamId + "&startup_id=" + Leap.getStartupIdByName(context.startupName),
                            "color": "#181818"
                        }
                        attachments.push(attachment)
                    }

                    var commentsByDates = {}

                    commentsList.forEach(function(commentsByDate) {
                      var localeDate = new Date(commentsByDate.date)

                      var dStr = localeDate.getDate()
                      if (dStr < 10)
                        dStr = '0' + dStr

                      var mStr = localeDate.getMonth() + 1
                      if (mStr < 10)
                        mStr = '0' + mStr

                      var yStr = localeDate.getFullYear()

                      localeDate = dStr + '/' + mStr + '/' + yStr

                      if (!commentsByDates[localeDate]) {
                        commentsByDates[localeDate] = {}
                        commentsByDates[localeDate]['compliments'] = []                   
                        commentsByDates[localeDate]['questions'] = []                   
                        commentsByDates[localeDate]['critics'] = []                   
                        commentsByDates[localeDate]['suggestions'] = []                   
                      }

                      var commentsByAuthors = commentsByDate.authors
                      console.log('>>> 510 <<<')

                      Object.keys(commentsByAuthors).forEach(function(commentKey) {
                        var commentsByAuthor = commentsByAuthors[commentKey]
                        Object.keys(commentsByAuthor).forEach(function(commentKey) {
                          var comment = commentsByAuthor[commentKey]
                          if (comment.topClass == 'CRITICA') {
                            commentsByDates[localeDate]['critics'].push({author: commentKey, comment: comment})
                          }else if (comment.topClass == 'ELOGIO') {
                            commentsByDates[localeDate]['compliments'].push({author: commentKey, comment: comment})
                          }else if (comment.topClass == 'SUGESTAO') {
                            commentsByDates[localeDate]['suggestions'].push({author: commentKey, comment: comment})
                          }else if (comment.topClass == 'PERGUNTA') {
                            commentsByDates[localeDate]['questions'].push({author: commentKey, comment: comment})
                          }
                        })
                      })
                    })

                    Object.keys(commentsByDates).forEach(function(date) {
                      var dateComments = commentsByDates[date]
                        var attachment = {
                          "title": "Feedbacks em " + date,
                            "color": "#181818"
                        }
                        attachments.push(attachment)

                        var comments = dateComments

                        var compliments = comments.compliments
                        if (compliments.length > 0) {

                          var complimentsAttachment = {
                              "color": "#008b76",
                              "fields": []
                          }
                          attachments.push(complimentsAttachment)
                          compliments.forEach(function(compliment) {
                          var field = {
                            value: compliment.comment.text
                          }
                          complimentsAttachment.fields.push(field)
                          })
                        } 

                        var questions = comments.questions
                        if (questions.length > 0) {
                          var questionsAttachment = {
                              "color": "#fc9462",
                              "fields": []
                          }
                          attachments.push(questionsAttachment)
                          questions.forEach(function(question) {
                          var field = {
                            value: question.comment.text
                          }
                          questionsAttachment.fields.push(field)
                          })
                        } 

                        var critics = comments.critics
                        if (critics.length > 0) {
                          var criticsAttachment = {
                              "color": "#b6313e",
                              "fields": []
                          }
                          attachments.push(criticsAttachment)
                          critics.forEach(function(critic) {
                          var field = {
                            value: critic.comment.text
                          }
                          criticsAttachment.fields.push(field)
                          })

                        } 

                        var suggestions = comments.suggestions
                        if (suggestions.length > 0) {
                          var suggestionsAttachment = {
                              "color": "#0099cc",
                              "fields": []
                          }
                          attachments.push(suggestionsAttachment)
                          suggestions.forEach(function(suggestion) {
                          var field = {
                            value: suggestion.comment.text
                          }
                          suggestionsAttachment.fields.push(field)
                          })
                        } 
                    })

                    web.chat.postMessage(message.channel, response.output.text[0], {as_user: false, attachments: attachments}, function(err, messageResponse) {
                      if (err) {
                        console.log(err)
                      }else {

                      }
                    })              
                  })
                }else if (context.action == 'action_list_comments') {
                  context.action = ''
                  Leap.listFeedbacks(context.startupName).then(function(commentsList) {
                    var attachments = []

                    commentsList.forEach(function(comments) {
                      var brDate = new Date(comments.date)
                      var localeDate = brDate.getDate() + '/' + brDate.getMonth() + '/' + brDate.getYear()
                      var commentsByAuthors = comments.authors
                      Object.keys(commentsByAuthors).forEach(function(authorKey) {
                        var authorName = Leap.getMemberNameById(slackTeamId, authorKey)
                      })                                                          
                      
                    })

                    web.chat.postMessage(message.channel, response.output.text[0], {as_user: false, attachments: attachments}, function(err, messageResponse) {
                      if (err) {
                        console.log(err)
                      }else {

                      }
                    })              
                  })
                }else if (context.action == 'action_list_startup_founders') {
                  console.log('>>> 130 <<<')
                  context.action = ''
                  Leap.listFounders(slackTeamId, context.startupName).then(function(foundersList) {
                    var attachments = []
                    for (var i = 0; i < foundersList.length; i++) {
                        var attachment = {
                            "title": foundersList[i].name,
                            "text": foundersList[i].email,
                            "color": "#7CD197"
                        }
                        attachments.push(attachment)                                
                    }
                    var resp = response.output.text[0].replace('NUM_MEMBERS', foundersList.length.toString())
                    web.chat.postMessage(message.channel, resp, {as_user: false, attachments: attachments}, function(err, messageResponse) {
                      if (err) {
                        console.log(err)
                      }else {

                      }
                    })              
                  })
                }else if (context.action == 'action_add_new_blue_ocean_curve') {
                  console.log('>>> 135 <<<')
                  context.action = ''
                  var key = Leap.addNewBlueOceanCurve(context.startupName, context.blueOceanCurveName, context.blueOceanCurveLink)
                  if (key) {
                    Leap.sendMessage(userId, '', context, function(err, response) {
                      context['startupName'] = null
                      web.chat.postMessage(message.channel, response.output.text[0], true, function(err, messageResponse) {
                        if (err) {

                        }else {

                        }
                      })
                    })
                  }else {
                    console.log('>>> 140 <<<')
                    console.log('Não conseguiu salvar curva de valor na base de dados')             
                  }
                }else if (context.action == 'action_add_new_canvas') {
                  console.log('>>> 125 <<<')
                  context.action = ''
                  var key = Leap.addNewCanvas(context.startupName, context.leanCanvasName, context.leanCanvasLink)

                  if (key) {
                    Leap.sendMessage(userId, '', context, function(err, response) {
                      context['startupName'] = null
                      web.chat.postMessage(message.channel, response.output.text[0], true, function(err, messageResponse) {
                        if (err) {

                        }else {

                        }
                      })
                    })              
                  }else {
                    console.log('>>> 140 <<<')
                    console.log('Não conseguiu salvar canvas na base de dados')             
                  }
                }else if (context.action == 'action_show_canvas_list') {
                  console.log('>>> 120 <<<')
                  context.action = ''
                  var startupName = context['startupName']
                  Leap.listBusinessModels(startupName).then(function(canvasList) {
                    if (canvasList.length > 0) {
                      var attachments = []
                      canvasList.forEach(function(canvas) {
                          var attachment = {
                              "title": canvas.name,
                              "title_link": canvas.link,
                              "text": canvas.link,
                              "color": "#7CD197"
                          }
                          attachments.push(attachment)                                
                      })

                      web.chat.postMessage(message.channel, response.output.text[0], {as_user: false, attachments: attachments}, function(err, messageResponse) {
                        if (err) {
                          console.log(err)
                        }else {

                        }
                      })
                    }else {
                      web.chat.postMessage(message.channel, 'A startup *' + startupName + '* não possui um canvas de modelo de negócio!', {as_user: false, attachments: attachments}, function(err, messageResponse) {
                        if (err) {
                          console.log(err)
                        }else {

                        }
                      })                  
                    }
                  })
                }
                // console.log(JSON.stringify(response, null, 2));            
            }     
          })
        }
      });
      
      web.team.info(function(err, info) {
        if (err) {
          console.log('aqui erro:', err);
        }else {
          slackTeamId = info.team.id
          Leap.setSlackTeam(slackTeamId, info.team.name, web).then(function(team) {
          })
        }
      });
      rtm.start();
    }
  }
}());


module.exports = SlackBot
