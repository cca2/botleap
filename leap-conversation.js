//Google scripts
var request = require('request');

// Initialize Firebase
// TODO: Replace with your project's customized code snippet
var firebase = require('firebase');
var config = {
  // apiKey: "<API_KEY>",
  // authDomain: "<PROJECT_ID>.firebaseapp.com",
  databaseURL: "https://foresight-f9060.firebaseio.com",
};
firebase.initializeApp(config);

var database = firebase.database();
var startupsDict = {};
var startupsIdsByName = {}

//IBM Watson Classification Service
var classifier_id = ''
var watson = require('watson-developer-cloud');
var fs     = require('fs');
var json2csv = require('json2csv');

var natural_language_classifier = watson.natural_language_classifier({
  username: '1b84258f-fbe2-4250-9f57-bfab43ba75ef',
  password: 'n0ZqaOGdez3U',
  version: 'v1'
});

// var params = {
//   language: 'pt',
//   name: 'Leap Comments Classifier',
//   training_data: fs.createReadStream('../../Downloads/leap_categories_train.csv')
// };

//kindOfCommentClassifier é um classificador de feedbacks
var kindOfCommentClassifier = 'ebd15ex229-nlc-53182'

// natural_language_classifier.create(params, function(err, response) {
//   if (err)
//     console.log(err);
//   else {
//     console.log(JSON.stringify(response, null, 2));
//     classifier_id = response.classifier_id
//   }
// });

// natural_language_classifier.list({},
//   function(err, response) {
//     if (err)
//         console.log('error:', err);
//       else
//         console.log(JSON.stringify(response, null, 2));
// });

natural_language_classifier.status({
  classifier_id: kindOfCommentClassifier },
  function(err, response) {
    if (err)
      console.log('error:', err);
    else
      console.log(JSON.stringify(response, null, 2));
});

//IBM Watson Conversation Service
var Conversation = require('watson-developer-cloud/conversation/v1'); // watson sdk

var conversation = new Conversation ({
  	"username": "f6054751-7f2a-49a3-865c-af235131c8a8",
  	"password": "edcFkzIApvhR",
	"version_date": "2017-05-26"
});

var workspaceId = '3816d525-def0-483b-8692-997bfa31121d';
var membersDict = {}
var slackTeamId

var Leap = (function() {
	return {
		updateStartupNames: updateStartupNames,
		updateMembersListFromSlack: updateMembersListFromSlack,
		classifyComments: classifyComments,
		getStartupIdByName: getStartupIdByName,

		appendCommentsToGoogleSpreadsheet: function(comments) {
			request.post(
			    'https://script.google.com/a/cin.ufpe.br/macros/s/AKfycbzifpHciIwW6mZTVE2FDDf0W1HI57Bcx1WRUBayg0z8b6dawCfu/exec',
			    { json: { comments: comments } },
			    function (error, response, body) {
			        if (!error && response.statusCode == 200) {
			            console.log(body)
			        }else  {
			        }
			    }
			);
		},
		
		test: function(startupName, writer, commentsList) {
			//Apagar feedbacks nas startups
			var startupsRef = firebase.database().ref('startups')
			var updates = {}
			return startupsRef.once('value', function(snapshot) {
				var startups = snapshot.val()
				Object.keys(startups).forEach(function(startupKey) {
					var startup = startups[startupKey]
					updates['startups/' + startupKey + '/feedbacks/'] = null
				})
				return firebase.database().ref().update(updates)
			}).then(function() {
				console.log('>>> 700 <<<')
				//Copiar comentários para Feedbacks em cada uma das startups
				var commentsRef = firebase.database().ref('comments')
				commentsRef.once('value', function(snapshot) {
					var comments = snapshot.val()
					// console.log(comments)
					var commentsDict = {}
					var updates = {}					

					Object.keys(comments).forEach(function(commentKey) {
						// console.log(comments[commentKey])
						var date = new Date(comments[commentKey].date)
						var dayOfMonth = date.getDate()
						var dayOfMonthStr = ''
						if (dayOfMonth < 10)
							dayOfMonthStr = '0' + dayOfMonth
						else
							dayOfMonthStr = dayOfMonth
						var dateStr = dayOfMonthStr + '-' + (date.getMonth() + 1) + '-' + date.getFullYear()

						var comment = comments[commentKey]
						if (!commentsDict[comment.startupID]) {
							commentsDict[comment.startupID] = {}
						}
						if (!commentsDict[comment.startupID][dateStr]) {
							commentsDict[comment.startupID][dateStr] = {}
						}					
						if (!commentsDict[comment.startupID][dateStr][comment.author]) {
							commentsDict[comment.startupID][dateStr][comment.author] = {}
						}

						commentsDict[comment.startupID][dateStr]['date'] = date
						commentsDict[comment.startupID][dateStr][comment.author][commentKey] = {
							text: comment.text,
							topClass: comment.topClass
						}

						// updates['startups/' + comments[commentKey].startupID + '/feedbacks/' + dateStr] = {
						// 	date: comments[commentKey].date,
						// 	author: comments[commentKey].author
						// }
					})

					console.log('>>> 400 <<<')
					console.log(commentsDict)

					Object.keys(commentsDict).forEach(function(startupKey) {
						var commentsByDate = commentsDict[startupKey]
						Object.keys(commentsByDate).forEach(function(date) {
							var commentsByAuthor = commentsByDate[date]
							Object.keys(commentsByAuthor).forEach(function(author) {
								var commentsByID = commentsByAuthor[author]
								Object.keys(commentsByID).forEach(function(id) {
									updates['startups/' + startupKey + '/feedbacks/' + date + '/date'] = commentsDict[startupKey][date].date
									updates['startups/' + startupKey + '/feedbacks/' + date + '/authors/' + author + '/' + id] = commentsDict[startupKey][date][author][id]
								})
							})
						})
					})
					return firebase.database().ref().update(updates)


					// firebase.database().ref().update(updates).then(function() {
					// 	console.log('Datas do feedbacks foram atualizadas')
					// })
				
				//Aqui não sei o que fazia
				// 		var comment = comments[commentKey]

				// 		if (!commentsDict[comment.startupID]) {
				// 			commentsDict[comment.startupID] = {}			
				// 		}

				// 		var date = new Date(comment.date)
				// 		var localeDate = date.getDate().toString() 
				// 		localeDate += '-' + date.getMonth().toString()
				// 		localeDate += '-' + date.getFullYear().toString()
				// 		if (!commentsDict[comment.startupID][localeDate]) {
				// 			commentsDict[comment.startupID][localeDate] = {}
				// 		}

				// 		if (!commentsDict[comment.startupID][localeDate][comment.author]) {
				// 			commentsDict[comment.startupID][localeDate][comment.author] = {}
				// 		}					

				// 		commentsDict[comment.startupID][localeDate][comment.author][commentKey] = {
				// 			text: comment.text,
				// 			topClass: comment.topClass
				// 		}

				// 		console.log(commentsDict[comment.startupID][localeDate][comment.author])
				// 	})
				// 	Object.keys(commentsDict).forEach(function(startupKey) {
				// 		var commentsByDate = commentsDict[startupKey]
				// 		Object.keys(commentsByDate).forEach(function(date) {
				// 			var commentsByAuthor = commentsByDate[date]
				// 			Object.keys(commentsByAuthor).forEach(function(author) {
				// 				var commentsByID = commentsByAuthor[author]
				// 				Object.keys(commentsByID).forEach(function(id) {
				// 					var updates = {}
				// 					updates['startups/' + startupKey + '/feedbacks/' + date + '/' + author + '/' + id] = commentsDict[startupKey][date][author][id]
				// 					firebase.database().ref().update(updates)
				// 				})
				// 			})
				// 		})
				// 	})
				})
			})
		},

		saveAndClassifyComments: function(startupName, writer, commentsList) {
			var startupId = getStartupIdByName(startupName)
			var commentsToSave = []

			commentsList.forEach(function(comment) {
				//Comentários sem autor ficam de autoria do usuário do slack
				if (comment.author == '')
					comment.author = writer
				else {
					//eliminar o autor do texto
					comment.text = comment.text.replace(comment.author, '').trim()
					//eliminar a formatação de slack do autor
					comment.author = comment.author.substring(2,11)
				}

				var commentToSave = {
					author: comment.author,
					startupID: startupId,
					text: comment.text,
					date: new Date(Date.now()),
					ELOGIO: 0.0,
					PERGUNTA: 0.0,
					CRITICA: 0.0,
					SUGESTAO: 0.0,
					topClass: ''
				}
				commentsToSave.push(commentToSave)				
			})
			//Classificar os comentários
			var promises = []

			commentsToSave.forEach(function(comment) {
				var promise = new Promise(function(resolve, reject) {
					natural_language_classifier.classify({
					  	text: comment.text,
					  	classifier_id: kindOfCommentClassifier },
					  	function(err, response) {
					    	if (err) {
					      		console.log('error:', err);
						      	reject()
					    	}
					    	else {
					    		var classes = response.classes
					    		var topClassConfidence
					    		classes.forEach(function(c) {
					    			if (c.class_name != 'Classificação') {
						    			comment[c.class_name] = c.confidence
						    			comment.topClass = response.top_class
					    			}
					    		})
					    		resolve('texto ' + comment.text + ' classificado')
					  		}
					    }
					)									
				})
				promises.push(promise)
			})
			return Promise.all(promises).then(function() {
				//Salva os comentários classificados na pasta de feedbacks
				var commentsRef = firebase.database().ref().child('comments')				
				var updates = {}
				commentsToSave.forEach(function(comment) {
					var dateToSave = new Date(comment.date)
					var dateToSaveStr = dateToSave.getDate() + '-' + (dateToSave.getMonth() + 1) + '-' + dateToSave.getFullYear()
					var newCommentKey = commentsRef.push().key
					updates['comments/' + newCommentKey] = comment
					updates['startups/' + comment.startupID + '/feedbacks/' + dateToSaveStr + '/date'] = dateToSave
					updates['startups/' + comment.startupID + '/feedbacks/' + dateToSaveStr + '/' + comment.author + '/' + newCommentKey] = {
						text: comment.text,
						topClass: comment.topClass
					}
					updates['startups/' + comment.startupID + '/comments/' + newCommentKey] = {
						author: comment.author,
						date: comment.date,
						comments: [comment.text]
					}
				})
				return firebase.database().ref().update(updates).then(function() {
				console.log('>>> 400 <<<')
				console.log(commentsToSave)
					return commentsToSave
				})
			})
			//Primeiro Salva o comentário na pasta de feedbacks
			// return 			
			//get all startups comments
			var unclassifiedComments = []
			var startupsRef = firebase.database().ref('startups')

			// return startupsRef.once('value', function (snapshot) {
			// 	var startups = snapshot.val()
			// 	Object.keys(startups).forEach(function(startupKey) {
			// 		var startupComments = startups[startupKey]['comments']
			// 		console.log(startupKey)
			// 		if (startupComments) {
			// 			Object.keys(startupComments).forEach(function(startupCommentKey) {
			// 				var startupComment = startupComments[startupCommentKey]
			// 				var author = startupComment.author
			// 				var date = startupComment.date
			// 				var texts = startupComment.comments

			// 				texts.forEach(function(text) {
			// 					var unclassifiedComment = {
			// 						startupID: startupKey,
			// 						author: author,
			// 						date: date,
			// 						text: text
			// 					}
			// 					unclassifiedComments.push(unclassifiedComment)
			// 				})
			// 			})
			// 		}
			// 	})

			// 	var promises = []
			// 	var numClassifiedComments = 100
			// 	unclassifiedComments.forEach(function(unclassifiedComment) {
			// 			if (numClassifiedComments >= 100) {
			// 				numClassifiedComments++;
			// 		var promise = new Promise(function(resolve, reject) {
			// 			natural_language_classifier.classify({
			// 			  	text: unclassifiedComment.text,
			// 			  	classifier_id: kindOfCommentClassifier },
			// 			  	function(err, response) {
			// 			  		console.log('classificando ' + unclassifiedComment.text)
			// 			    	if (err) {
			// 			      		console.log('error:', err);
			// 				      	reject()
			// 			    	}
			// 			    	else {
			// 			    		console.log('>>> 440 <<<')
			// 			    		var classes = response.classes
			// 			    		var topClassConfidence
			// 			    		classes.forEach(function(c) {
			// 			    			if (c.class_name != 'Classificação') {
			// 				    			unclassifiedComment[c.class_name] = c.confidence
			// 				    			unclassifiedComment.topClass = response.top_class
			// 			    			}
			// 			    		})

			// 			    		console.log(unclassifiedComment)
			// 			    		console.log('total comments: ' + unclassifiedComments.length)
			// 			    		console.log(numClassifiedComments)

			// 			    		resolve('texto ' + unclassifiedComment.text + ' classificado')
			// 			  		}
			// 			    }
			// 			)					
			// 		})		
			// 		console.log(promises)				
			// 		promises.push(promise)
			// 			}
			// 	})
			// 	return Promise.all(promises).then(function() {
			// 		console.log('>>> 450 <<<')
			// 		databaseRef = firebase.database().ref()
			// 		commentsRef = databaseRef.child('comments')

			// 		// var classifiedCommentsPromises = []
			// 		var numClassifiedComments = 100
			// 		unclassifiedComments.forEach(function(classifiedComment) {
			// 			if (numClassifiedComments >= 100) {
			// 				numClassifiedComments++
			// 				console.log(classifiedComment)
			// 				var newClassifiedCommentKey = commentsRef.push(classifiedComment).key
			// 			}
			// 		})
			// 		// return classifiedCommentsPromises
			// 	})
			// })
			//classify them			
			//save to the database
		},

		// saveAndClassifyComments: function() {
		// 	//get all startups comments
		// 	var unclassifiedComments = []
		// 	var startupsRef = firebase.database().ref('startups')
		// 	return startupsRef.once('value', function (snapshot) {
		// 		var startups = snapshot.val()
		// 		Object.keys(startups).forEach(function(startupKey) {
		// 			var startupComments = startups[startupKey]['comments']
		// 			console.log(startupKey)
		// 			if (startupComments) {
		// 				Object.keys(startupComments).forEach(function(startupCommentKey) {
		// 					var startupComment = startupComments[startupCommentKey]
		// 					var author = startupComment.author
		// 					var date = startupComment.date
		// 					var texts = startupComment.comments

		// 					texts.forEach(function(text) {
		// 						var unclassifiedComment = {
		// 							startupID: startupKey,
		// 							author: author,
		// 							date: date,
		// 							text: text
		// 						}
		// 						unclassifiedComments.push(unclassifiedComment)
		// 					})
		// 				})
		// 			}
		// 		})

		// 		var promises = []
		// 		var numClassifiedComments = 100
		// 		unclassifiedComments.forEach(function(unclassifiedComment) {
		// 				if (numClassifiedComments >= 100) {
		// 					numClassifiedComments++;
		// 			var promise = new Promise(function(resolve, reject) {
		// 				natural_language_classifier.classify({
		// 				  	text: unclassifiedComment.text,
		// 				  	classifier_id: kindOfCommentClassifier },
		// 				  	function(err, response) {
		// 				  		console.log('classificando ' + unclassifiedComment.text)
		// 				    	if (err) {
		// 				      		console.log('error:', err);
		// 					      	reject()
		// 				    	}
		// 				    	else {
		// 				    		console.log('>>> 440 <<<')
		// 				    		var classes = response.classes
		// 				    		var topClassConfidence
		// 				    		classes.forEach(function(c) {
		// 				    			if (c.class_name != 'Classificação') {
		// 					    			unclassifiedComment[c.class_name] = c.confidence
		// 					    			unclassifiedComment.topClass = response.top_class
		// 				    			}
		// 				    		})

		// 				    		console.log(unclassifiedComment)
		// 				    		console.log('total comments: ' + unclassifiedComments.length)
		// 				    		console.log(numClassifiedComments)

		// 				    		resolve('texto ' + unclassifiedComment.text + ' classificado')
		// 				  		}
		// 				    }
		// 				)					
		// 			})		
		// 			console.log(promises)				
		// 			promises.push(promise)
		// 				}
		// 		})
		// 		return Promise.all(promises).then(function() {
		// 			console.log('>>> 450 <<<')
		// 			databaseRef = firebase.database().ref()
		// 			commentsRef = databaseRef.child('comments')

		// 			// var classifiedCommentsPromises = []
		// 			var numClassifiedComments = 100
		// 			unclassifiedComments.forEach(function(classifiedComment) {
		// 				if (numClassifiedComments >= 100) {
		// 					numClassifiedComments++
		// 					console.log(classifiedComment)
		// 					var newClassifiedCommentKey = commentsRef.push(classifiedComment).key
		// 				}
		// 			})
		// 			// return classifiedCommentsPromises
		// 		})
		// 	})
		// 	//classify them			
		// 	//save to the database
		// },

		setSlackTeam: function(teamId, teamName, web) {
			membersDict[teamId] = {}
			slackTeamId = teamId
			//Verificar se o team existe no slack
			var slackTeamsRef = firebase.database().ref('slack_teams')
			return slackTeamsRef.once('value', function(snapshot) {
				var teams = snapshot.val()
				if (!teams[teamId]) {
					var newSlackTeamRef = firebase.database().ref('slack_teams/' + teamId)
					return newSlackTeamRef.set({
						id: teamId,
						name: teamName
					}).then(function() {
						monitorNewStartups(teamId)
					})
				}else {
					monitorNewStartups(teamId)
				}
			}).then(function() {
				web.users.list(function(err, list) {
					if (err) {

					}else {
						var members = list.members
						for (var i = 0; i < members.length; i++) {
							console.log(members[i].profile.name) 
							if (members[i].profile.email) {
								var member = {
									name: members[i].profile.real_name,
									slackName: members[i].profile.display_name,
									email: members[i].profile.email
								}			
								membersDict[teamId][members[i].id] = member								
							}
						}
						updateMembersListFromSlack(teamId, membersDict).then(function() {
						})
					}
				})			
			})
		},

		getMemberNameById: function(teamId, memberId) {
			if (membersDict[teamId][memberId])
				return membersDict[teamId][memberId].name
			else
				return null
		},

		createStartup: function(teamId, startupName, founderId) {
			var newStartup = {
				name: startupName,
				slackTeam: teamId,
				creatorId: founderId,
				founders: {}
			}
			newStartup.founders[founderId] = {active: true}

			var newStartupKey = firebase.database().ref().child('startups').push(newStartup).key
			var updates = {}
			updates['/startups/' + newStartupKey] = newStartup
			return firebase.database().ref().update(updates).then(function() {
				return firebase.database().ref('slack_teams/' + teamId + '/startups/' + newStartupKey).set(startupName)
			})
		},

		addNewComments: function(startupName, writer, commentsList) {
			var commentsDict= {}
			var startupId = startupsIdsByName[startupName]
			//Add feedbacks to feedbacks
			if (!commentsDict[comment.startupId]) {
				commentsDict[comment.startupId] = {}			
			}

			var date = new Date(Date.now())
			var localeDate = date.getDate().toString() 
			localeDate += '-' + date.getMonth().toString()
			localeDate += '-' + date.getFullYear().toString()

			commentsList.forEach(function(comment) {
				author = writer
				if (!comment.author) {
					comment['author'] = author
				}else {
					author = comment['author']
				}

				// if (!comments[author]) {
				// 	comments[author] = []
				// }

				if (!commentsDict[comment.startupId][localeDate]) {
					commentsDict[comment.startupId][localeDate] = {}
				}

				if (!commentsDict[comment.startupId][localeDate][author]) {
					commentsDict[comment.startupId][localeDate][author] = {}
				}					

				commentsDict[comment.startupId][localeDate][author][commentKey] = {
					text: comment.text,
					topClass: comment.topClass
				}
			})

			return
			//Add commentsList to comments
			// var startupId = startupsIdsByName[startupName]
			var startupRef = database.ref('startups/' + startupId)
			var commentsRef = startupRef.child('comments')
			var d = new Date(Date.now())
			var dateStr = d.toString()

			var comments = {}
			comments[writer] = []

			commentsList.forEach(function(comment) {
				author = writer

				if (!comment.author) {
					comment['author'] = author
				}else {
					author = comment['author']
				}

				if (!comments[author]) {
					comments[author] = []
				}
				comments[author].push(comment.text.replace(author, '').trim())
			})

			Object.keys(comments).forEach(function (authorKey) {
				if (comments[authorKey].length > 0) {
					var commentsKey = commentsRef.push({
						author: authorKey.replace('<@', '').replace('>', ''),
						comments: comments[authorKey],
						date: dateStr,
					}).key
				}
			})
			// var commentsKey = commentsRef.push({
			// 	author: author,
			// 	comments: comments,
			// 	date: dateStr,
			// }).key
			// return commentsKey
			// return null			
		},
		
		downloadCSVFile: function() {
			//pega todos os comentários até o limite
			console.log('>>> 180 <<<')
			var startupsRef = firebase.database().ref('startups')
			return startupsRef.once('value').then(function(snapshot) {
				console.log('>>> 190 <<<')
				var startups = snapshot.val()
				var comments = []
				Object.keys(startups).forEach(function(key) {
					console.log('>>> 195 <<<')
					var startupComments = startups[key].comments
					if (startupComments) {
						Object.keys(startupComments).forEach(function(commentKey) {
							console.log('>>> 200 <<<')
							var mentorComments = startupComments[commentKey].comments
							if (mentorComments) {
								mentorComments.forEach(function(comment) {									
									comments.push({'Comentário': comment, 'Classificação': 'SEM_CLASSIFICACAO'})
								})
							}
						})
					}
				})

				console.log('>>> 210 <<<')				
				console.log(comments)

				var newLine= "\r\n";

				var fields = ['Comentário', 'Classificação'];

				var appendThis = comments

				var toCsv = {
				    data: appendThis,
				    fields: fields,
				    hasCSVColumnTitle: true
				};

				fs.stat('./leap_categories_train.csv', function (err, stat) {
				    if (err == null) {
				        console.log('File exists');

				        //write the actual data and end with newline
				        var csv = json2csv(toCsv) + newLine;

				        fs.appendFile('./leap_categories_train.csv', csv, function (err) {
				            if (err) throw err;
				            console.log('The "data to append" was appended to file!');
				        });
				    }
				    else {
				        //write the headers and newline
				        console.log('New file, just writing headers');
				        fields = (fields + newLine);

						fs.writeFile('./leap_categories_train.csv', fields, 'utf8', function (err) {
						  if (err) {
						    console.log('Some error occured - file either not saved or corrupted file saved.');
						  } else{
						    console.log('It\'s saved!');
						  }
						});
				    }
				});

			})
		},

		addNewCanvas: function(startupName, canvasName, canvasLink) {
			var startupId = startupsIdsByName[startupName]
			var startupRef = database.ref('startups/' + startupId)
			var leanCanvasesRef = startupRef.child('lean-canvases')
			var newCanvasKey = leanCanvasesRef.push({
				name: canvasName,
				link: canvasLink,
				validated: false,
				invalidated: false,
				active: false
			}).key
			return newCanvasKey
		},

		listFeedbacks: function(startupName) {
			var startupId = startupsIdsByName[startupName]
			var commentsRef = database.ref('startups/' + startupId + '/feedbacks').orderByKey().limitToLast(10)
			return commentsRef.once('value').then(function(snapshot) {
  				var commentsList = []
  				var commentsDict = snapshot.val()
  				console.log('>>> 700')
				if (commentsDict) {
					Object.keys(commentsDict).forEach(function(key) {
						var comments = commentsDict[key]
						commentsList.push(comments)
					})
  		// 		var keys = Object.keys(commentsDict)
	  	// 			for (var i = 0; i < keys.length; i++) {
	  	// 				var comments = commentsDict[keys[i]]
	  	// 				commentsList.push(comments)
	  	// 			}
				}  		
				commentsList.reverse()		
  				return commentsList
  			})
		},

		listBusinessModels: function(startupName) {
			var startupId = startupsIdsByName[startupName]
			var canvasRef = database.ref('startups/' + startupId + '/lean-canvases')
			return canvasRef.once('value').then(function(snapshot) {
  				var canvasList = []
  				var canvases = snapshot.val()
				if (canvases) {
  				var keys = Object.keys(canvases)
	  				for (var i = 0; i < keys.length; i++) {
	  					var canvas = canvases[keys[i]]
	  					canvasList.push(canvas)
	  				}
				}  				
  				return canvasList
  			})
		},

		listEntrepreneurs: function(teamId) {
			var slackTeamRef = firebase.database().ref('slack_teams/' + teamId)
			return slackTeamRef.once('value').then(function(snapshot) {
				var slackTeam = snapshot.val()
				var entrepreneursList = []

				if (slackTeam) {
					var members = slackTeam.members
					Object.keys(members).forEach(function(memberKey) {
						console.log(members[memberKey].name)
					})
				}
			})
		},

		isStartupInSlackTeam: function(teamId, startupName) {
			var result = false
			var startupID = getStartupIdByName(startupName)
			if (startupsDict[startupID].slackTeam == teamId)
				result = true
			return result
		},

		listStartups: function(teamId) {
			startupsList = []
			Object.keys(startupsDict).forEach(function(key) {
				if (startupsDict[key].slackTeam == teamId)
					startupsList.push(startupsDict[key])
			})
			return startupsList
		},
		
		listFounders: function(teamId, startupName) {
			var startupId = startupsIdsByName[startupName]
			var foundersRef = database.ref('startups/' + startupId + '/founders')
			return foundersRef.once('value').then(function(snapshot) {
  				var foundersList = []
  				var founders = snapshot.val()
				if (founders) {
	  				var keys = Object.keys(founders)
	  				keys.forEach(function(founderKey) {
	  					var founder = membersDict[teamId][founderKey]
	  					foundersList.push(founder)
	  				})
				}
				console.log('>>> 400 <<<')
				console.log(membersDict)
				console.log(founders)
				console.log(foundersList)
  				return foundersList
  			})
		},
		
		listWorkspaces: function() {
			conversation.listWorkspaces(function(err, response) {
				if (err) {
					console.error(err);
				} else {
					console.log(JSON.stringify(response, null, 2));
				}
			});
		},

		sendMessage: function(text, context, responseFunc) {
			console.log ('>>> 250 <<<')
			console.log(text)
			conversation.message({
			  workspace_id: workspaceId,
			  input: {'text': text},
			  context: context
			},  function(err,response){
				responseFunc(err, response);
			});			
		},
	}
}())

function classifyComments (startupName) {
	var startupId = startupsIdsByName[startupName]	
	var commentsRef = database.ref('startups/' + startupId + '/comments').orderByKey().limitToLast(10)
	var commentsList = []
	return commentsRef.once('value').then(function(snapshot) {
		var commentsDict = snapshot.val()
		if (commentsDict) {
			var promises = []
			Object.keys(commentsDict).forEach(function(key) {
				var commentsPerMentor = commentsDict[key]
				commentsPerMentor['classifiedComments'] = []
				var comments = commentsPerMentor.comments
				var classifiedComments = []
				comments.forEach(function(comment) {
					promises.push(new Promise(function(resolve, reject) {
						natural_language_classifier.classify({
						  	text: comment,
						  	classifier_id: kindOfCommentClassifier },
						  	function(err, response) {
						    	if (err)
						      		console.log('error:', err);
						    	else {
						    		var classes = response.classes
						    		var topClassConfidence
						    		classes.forEach(function(c) {
						    			if (c.class_name == response.top_class) {
						    				topClassConfidence = (c.confidence * 100).toPrecision(2)
						    			}
						    		})
							      	commentsPerMentor['classifiedComments'].push({'text': comment, 'classification': response.top_class})
						      		resolve()
						  		}
						    }
						);
					}))
				})
				commentsList.push(commentsPerMentor)
			})

			commentsList.reverse()		
			return Promise.all(promises)			
		}		
	}).then(function(){
		var classifiedCommentsList = []  				
		commentsList.forEach(function(mentorComments){
			var classifiedComments = {
				author: mentorComments.author,
				date: mentorComments.date,
				compliments: [],
				questions: [],
				critics: [],
				suggestions: []
			}

			mentorComments.classifiedComments.forEach(function(comment) {
				if (comment.classification == 'ELOGIO') {
					classifiedComments.compliments.push(comment)
				}else if (comment.classification == 'PERGUNTA') {
					classifiedComments.questions.push(comment)
				}else if (comment.classification == 'CRITICA') {
					classifiedComments.critics.push(comment)
				}else if (comment.classification == 'SUGESTAO') {
					classifiedComments.suggestions.push(comment)
				}
			})
			classifiedCommentsList.push(classifiedComments)
		})
		return classifiedCommentsList
	})
}

function updateMembersListFromSlack (teamId, members) {
	var updates = {}
	Object.keys(members[teamId]).forEach(function(key) {
		var member = members[teamId][key]
		if (key != 'USLACKBOT' && member.email) {
		    updates['/members/' + key] = member
		}
	});
	return firebase.database().ref('slack_teams/' + teamId).update(updates)
}


function monitorNewStartups (teamId) {
	// Monitorar a criação de novas startups
	var startups = firebase.database().ref('/startups');
	startups.on('value', function(snapshot) {
		startupsDict = snapshot.val();
		if (startupsDict) {
			var startupsIds = Object.keys(startupsDict);
			var startupNames = [];
			for (var i = 0; i < startupsIds.length; i++) {
				var startupName = startupsDict[startupsIds[i]].name
				startupNames.push({'value': startupName})
				startupsIdsByName[startupName] = startupsIds[i]
			}

			updateStartupNames(startupNames, function(err, response) {
				if (err) {
					console.log(err)
				}else {
					console.log('Nomes das startups atualizados')
				}
			})			
		}
	});

	var members = firebase.database().ref('slack_teams/' + teamId + '/members')
	members.on('value', function(snapshot) {
		// membersDict = snapshot.val()
	})

}

function updateStartupNames(names, responseFunc) {

	var params = {
	  workspace_id: workspaceId,
	  old_entity: 'startup-name',
	  entity: 'startup-name',
	  description: 'Nomes das startups',
	  values: names
	};

	conversation.updateEntity(params, function(err, response) {
		responseFunc(err, response)
	});			
}

function getStartupIdByName(startupName) {
	return startupsIdsByName[startupName]
}



module.exports = Leap;