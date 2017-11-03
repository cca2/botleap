#!/usr/bin/env
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

//IBM Watson Conversation
// 


require('dotenv').config({silent: true});

var server = require('./app')
var Leap = require('./leap-conversation')

var slackBot = require('./slack-bot')

var RtmClient = require('@slack/client').RtmClient;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;

var WebClient = require('@slack/client').WebClient;

slackBot.activateSlackBots().then(function(slackBotTokens) {
	console.log('>>> 400 <<<')
	console.log('port: ' + (port))
	var port = process.env.PORT || process.env.VCAP_APP_PORT || 3000;

	server.listen(port, function() {
	  	console.log('Server running on port: %d', port);
		slackBotTokens.forEach(function(token) {
			var rtm = new RtmClient(token);
			var web = new WebClient(token);

			let channel;


			let context = {};

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

			// you need to wait for the client to fully connect before you can send messages
			// rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function () {
			//   rtm.sendMessage("Hello!", channel);
			// });

			rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {
				var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
				var payload = {
					workspace_id: workspace,
					context: {},
					input: {'text': message.text}
				};

				// Send the input to the conversation service
				var isBotChannel = false
				// messageChannels.forEach(function(channel) {
					if (message.channel.startsWith('D'))
						isBotChannel = true
				// })

				// web.users.list(function(err, list) {
					// if  (err) {

					// }else {
						// var members = list.members
						// members.forEach(function(member) {
							// if (member.profile.real_name == 'leapbot') {
								// console.log('>>> LEAP BOT PRESENT <<<')
								// console.log(member.id)

								// var leapBotID = member.id

								// web.im.list(function(err, imList) {
								// 	var imList = imList.ims
								// 	var leapBotIMChannel = null
								// 	imList.forEach(function(im) {
								// 		console.log (im.user)
								// 		console.log(im.id)
								// 		if (im.user == leapBotID) {
								// 			leapBotIMChannel = im.id
								// 		}
								// 	})

								// 	if (leapBotIMChannel) {
								// 		console.log('>>> MESSAGE IN THE LEAPBOT IM CHANNEL')
								// 	}
								// })
								if ((message.username != 'projetaobot' && message.username != 'leapbot' && message.username != 'leapacademy') && isBotChannel) {
									Leap.sendMessage(message.text, context, function(err, response) {
									  	if (err) {
									    	console.log('error:', err);
									  	}else {
									  		context = response.context;
									  		console.log('>>> 100 <<<')
									  		console.log(context.action)
									  		if (!context.action || context.action == '') {
									  			console.log('>>> 110 <<<')
										    	web.chat.postMessage(message.channel, response.output.text[0], true, function(err, messageResponse) {
										    		if (err) {

										    		}else {

										    		}
										    	})
									  		}else if (context.action == 'action_test') {
									  			context.action =  ''
									  			// Leap.downloadCSVFile()
									  			Leap.test()
										    	web.chat.postMessage(message.channel, response.output.text[0], true, function(err, messageResponse) {
										    		if (err) {

										    		}else {

										    		}
										    	})
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
									  			console.log(startupsList)
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
												    			console.log('>>> 500 <<<')
												    			console.log(commentsSaved)					    			
													  			Leap.appendCommentsToGoogleSpreadsheet(commentsSaved)
												    		}
												    	})		  				
									  				})
									  			// }
									  		}else if (context.action == 'action_classify_comments') {
									  			context.action = ''
									  			// Leap.classifyComments(context.startupName).then(function(commentsList) {
									  			Leap.listFeedbacks(context.startupName).then(function(commentsList) {
									  				console.log('>>> 500 <<<')
									  				console.log(commentsList)

									  				var attachments = []

									  				if (commentsList.length == 0) {
												        var attachment = {
												        	"title": "Não há comentários sobre a " + context.startupName,
												            "color": "#181818"
												        }
												        attachments.push(attachment)
									  				}else {
												        var attachment = {
												        	"title": "Mais detalhes pode ser vistos em http://localhost:8080/comments/" + slackTeamId + "/" + Leap.getStartupIdByName(context.startupName),
												            "color": "#181818"
												        }
												        attachments.push(attachment)
									  				}

									  				var commentsByDates = {}

									  				commentsList.forEach(function(commentsByDate) {
									  					var localeDate = new Date(commentsByDate.date).toLocaleDateString('pt-BR')
									  					console.log('>>> 505')
									  					console.log(localeDate)

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
										  						console.log(comment)
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
									  					console.log('>>> 700 <<<')
									  					console.log(date)
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
									  				console.log(commentsList)
									  				var attachments = []
									  				// for (var i = 0; i < commentsList.length; i++) {
								  					commentsList.forEach(function(comments) {
										  				var brDate = new Date(comments.date)
										  				var localeDate = brDate.getDate() + '/' + brDate.getMonth() + '/' + brDate.getYear()
										  				var commentsByAuthors = comments.authors
										  				Object.keys(commentsByAuthors).forEach(function(authorKey) {
										  					console.log(authorKey)
										  					var authorName = Leap.getMemberNameById(slackTeamId, authorKey)
										  				})																								  				
										  				
												    //     var attachment = {
												    //     	"title": "Comentários de " + authorName,
												    //         "text": localeDate,
												    //         "color": "#b6313e"
												    //     }
												    //     attachments.push(attachment)	  										        
									  					// for (var j = 0; j < comments.length; j++) {
													   //      var attachment = {
													   //      	"title": "comentário",
													   //          "text": comments[j],
													   //          "color": "#7CD197"
													   //      }
													   //      attachments.push(attachment)  										        
									  					// }

								  					})
									  				// }
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
									  				console.log(foundersList)
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
									  		}else if (context.action == 'action_add_new_canvas') {
									  			console.log('>>> 125 <<<')
									  			context.action = ''
									  			var key = Leap.addNewCanvas(context.startupName, context.leanCanvasName, context.leanCanvasLink)

									  			if (key) {
										  			Leap.sendMessage('', context, function(err, response) {
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
							// }
						// })
					// }
				// })
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
		})
	});

})

