"use strict";

/**
* Import Packages
*/
// To create a nice http api
const express = require('express')
// for file handling
const busboy = require('connect-busboy')
//used for file path
let path = require('path')
// Medicalrecords database
// const db = require('mongoskin').db('mongodb://localhost:27017/medicalrecords');
const bodyParser = require('body-parser')
const _ = require('lodash');
var request = require('request');
const q = require('q');

let base_url = 'https://vivid-inferno-9795.firebaseio.com/';
let token ="EAAJRYk107AABALB6dAbSYnM6wUwfSwSuDLmZCb3swunuhO5dqPu7KfRqcBn6Sw5Kt53GIwJglaZA5ue6v5EeTLRU6fhnKUwOIufRaHysGZAE3L6QclFAFXEjo9RT6db4dS4xRCNf58mIxZCt7pZBBMyD8VY5HJG7lLwXMo6i1qQZDZD"

let users_captions = [];
let conversations_active = [];
// Creates a segment of a UUID
let s4 = () => {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
}

// Generates UUID
let guid = () => {
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
};



let app = express();
app.use(busboy());
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));

// Activate CORS
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  next()
})

// [{"conversation":0,"name":"user1","current_state":"sending_photo","waiting":false}]

app.get('/gifwar/webhook', function (req, res) {
  if (req.query['hub.verify_token'] === 'YOUR_VERIFY_TOKEN') {
    res.send(req.query['hub.challenge']);
  } else {
    res.send('Error, wrong validation token');    
  }
});

app.get('/gifwar/', function (req, res) {
  res.send("HELLO")
});


function patch_firebase(json){
  request.patch({ url: base_url+'/.json', json: { slash: json} }, function (error, response, body) {
    // console.log(body);
  });
}

function start(unique_id){
  let name = 'random'
  let deferred = q.defer();
  let msg = '';
  request(base_url+'slash/.json', function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var json = JSON.parse(body);
      var should_join_existing_conversation = (_.filter(json, { waiting: false }).length % 5) >= 3;
      var conversations = _.union(json.map(function(value) { return parseInt(value.conversation); }));
      var new_user = {}
      if(_.find(json, { unique_id: unique_id }) !== undefined){
        msg = "Already in a conversation or waiting";
      } else if(should_join_existing_conversation){
        console.log("should_join_existing_conversation");
        var conversation_to_join = 0;
        var current_state = '';
        for(let i = 0; i < conversations.length; i++){
          var users_in_conversation = _.filter(json, { conversation: conversations[i], waiting: false });
          if(users_in_conversation.length < 5){
            conversation_to_join = conversations[i];
            current_state = users_in_conversation.current_state;
            break;
          }
        }
        new_user = {"conversation":conversation_to_join,"name": name,"current_state":current_state, "waiting":false, "unique_id": unique_id};
        json.push(new_user);
        msg = 'You just joined an existing game!'
      } else {
        console.log("not should_join_existing_conversation");
        var people_in_queue = _.filter(json, { waiting: true });
        var at_least_two_people_in_queue = (people_in_queue.length) >= 2;
        var conversation_to_join = _.max(conversations) + 1;
        if(at_least_two_people_in_queue){
          console.log("at_least_two_people_in_queue");
          console.log(people_in_queue);
          for(let j = 0; j < json.length; j++){
            for(let k = 0; k < people_in_queue.length; k++){
              if(json[j].unique_id == people_in_queue[k].unique_id){
                json[j].waiting = false;
                json[j].conversation = conversation_to_join;
                json[j].current_state = "sending_photo";
              }
            }
          }
          new_user = {"conversation":conversation_to_join,"name": name,"current_state": "sending_photo", "waiting":false, "unique_id": unique_id};
          json.push(new_user);
          msg = 'Starting a new game';
        } else {
          console.log("not at_least_two_people_in_queue");
          new_user = {"conversation":0,"name": name,"current_state": "sending_photo", "waiting":true, "unique_id": unique_id};
          json.push(new_user);
          msg = 'Not enough people to start a game';
        }
      }
      patch_firebase(json);
      console.log(should_join_existing_conversation);
      //(json.length % 5)
      console.log(json.length) // Show the HTML for the Google homepage.
      if(new_user.waiting == true){
        console.log('A"')
        console.log(new_user)
        deferred.reject(msg)
      } else {
        console.log('B')
        console.log(new_user);
        deferred.resolve({ msg: msg, json: json, user: new_user});
      }
      //ar 
    }
  });
  return deferred.promise;
}

function stop(unique_id){
  var deferred = q.defer();
  request(base_url+'slash/.json', function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var json = JSON.parse(body);
      var user = _.find(json, { unique_id: unique_id });
      console.log(user);
      if(user !== undefined) {
        if(user.waiting == false){
          console.log("user not waiting")
          var people_in_conversation = [];
          for(let i = 0; i < json.length; i++){
            if(json[i].conversation == user.conversation)
              people_in_conversation.push(i);
          }
          console.log("people_in_conversation")
          console.log(people_in_conversation);
          if(people_in_conversation.length <= 3 ){
            console.log("people_in_conversation less or equal than 3")
            for(var i = 0; i < people_in_conversation.length; i++){
              json[people_in_conversation[i]].waiting = true;
              json[people_in_conversation[i]].conversation = 0;
              json[people_in_conversation[i]].current_state = "sending_photo";
            }
            conversations_active = _.filter(conversations_active, function(o){ return ( o.id != user.conversation ) })
          } else {
            console.log("people_in_conversation greater than 3")
          }
        } else {
          console.log("user  waiting")
        }
        json = _.pull(json, user);
        patch_firebase(json);
        deferred.resolve("Left current party");
      } else {
        deferred.resolve("Left current party.")
      }
    } else {
      deferred.resolve("Left current party.")
    }
  });
  return deferred.promise;
};

app.get("/send_photo", function(req, res){
  var unique_id = req.query['unique_id'];
  request(base_url+'slash/.json', function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var json = JSON.parse(body);
      var user_index = _.findIndex(json, { unique_id: unique_id });
      var user = json[user_index];
      if(user.waiting == false){
        var people_in_conversation = [];
        for(let i = 0; i < json.length; i++){
          if(json[i].conversation == user.conversation)
            people_in_conversation.push(i);
        }
        json[user_index].current_state = "sent_photo";
        var done_sending_photos = true;
        for(var i = 0; i < people_in_conversation.length; i++){
          if(json[people_in_conversation[i]].current_state != "sent_photo"){
            done_sending_photos = false;
            break;
          }
        }
        if(done_sending_photos){
          console.log("done_sending_photos")
          for(var i = 0; i < people_in_conversation.length; i++){
            json[people_in_conversation[i]].current_state = "writing_captions"
          }
        }
        patch_firebase(json);
        res.send(json);
      }
    } else {
      console.log("user is waiting")
      res.send(json);
    }
  });
});

function obtain_json(){
  var deferred = q.defer();
  request(base_url+'slash/.json', function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var json = JSON.parse(body);
      deferred.resolve(json);
    } else {
      deferred.reject()
    }
  })
  return deferred.promise;
}
app.get("/write_caption", function(req, res){
  var unique_id = req.query['unique_id'];
  request(base_url+'slash/.json', function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var json = JSON.parse(body);
      var user_index = _.findIndex(json, { unique_id: unique_id });
      var user = json[user_index];
      if(user.waiting == false){
        var people_in_conversation = [];
        for(let i = 0; i < json.length; i++){
          if(json[i].conversation == user.conversation)
            people_in_conversation.push(i);
        }
        json[user_index].current_state = "wrote_caption";
        var done_sending_photos = true;
        for(var i = 0; i < people_in_conversation.length; i++){
          if(json[people_in_conversation[i]].current_state != "wrote_caption"){
            done_sending_photos = false;
            break;
          }
        }
        if(done_sending_photos){
          console.log("done_sending_photos")
          for(var i = 0; i < people_in_conversation.length; i++){
            json[people_in_conversation[i]].current_state = "voting"
          }
        }
        patch_firebase(json);
        res.send(json);
      }
    } else {
      console.log("user is waiting")
      res.send(json);
    }
  });
});

app.get("/vote", function(req, res){
  var unique_id = req.query['unique_id'];
  request(base_url+'slash/.json', function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var json = JSON.parse(body);
      var user_index = _.findIndex(json, { unique_id: unique_id });
      var user = json[user_index];
      if(user.waiting == false){
        var people_in_conversation = [];
        for(let i = 0; i < json.length; i++){
          if(json[i].conversation == user.conversation)
            people_in_conversation.push(i);
        }
        json[user_index].current_state = "voted";
        var done_sending_photos = true;
        for(var i = 0; i < people_in_conversation.length; i++){
          if(json[people_in_conversation[i]].current_state != "voted"){
            done_sending_photos = false;
            break;
          }
        }
        if(done_sending_photos){
          console.log("done_sending_photos")
          for(var i = 0; i < people_in_conversation.length; i++){
            json[people_in_conversation[i]].current_state = "sending_photo"
          }
        }
        patch_firebase(json);
        res.send(json);
      }
    } else {
      console.log("user is waiting")
      res.send(json);
    }
  });
});


function sendTextMessage(sender, text) {
    let messageData = { text:text }
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token:token},
        method: 'POST',
        json: {
            recipient: {id:sender},
            message: messageData,
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }
    })
}

function obtainRandomGif(){
  var deferred = q.defer();
  request({
      url: 'http://api.giphy.com/v1/gifs/trending?api_key=dc6zaTOxFJmzC',
      method: 'GET',
  }, function(error, response, body) {
      if (error) {
          console.log('Error sending messages: ', error)
          deferred.reject()
      } else if (response.body.error) {
          console.log('Error: ', response.body.error)
          deferred.reject();
      } else {
        let j = JSON.parse(body)
        // console.log(j);
        let urls = j.data.map(function(element){
          return element.images.fixed_height.url;
        })
        let url = urls[Math.floor(Math.random()*urls.length)]
        console.log(url);
        deferred.resolve(url)
      }
  })
  return deferred.promise;
}
function sendImage(sender, url) {
    let messageData = {
        "attachment": {
            "type": "image",
            "payload": {
                "url": url
            }
        }
    }
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token:token},
        method: 'POST',
        json: {
            recipient: {id:sender},
            message: messageData,
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }
    })
}

function obtain_payload_element(text, url, user){
  return {
      "title":text,
      "image_url": url,
      "buttons": [{
          "type": "postback",
          "title": "Vote for this",
          "payload": user.unique_id,
      }],
  }
}
function send_voting_menu(sender, elements) {
    let messageData = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "generic",
                "elements": elements
            }
        }
    }
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token:token},
        method: 'POST',
        json: {
            recipient: {id:sender},
            message: messageData,
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }
    })
}

function start_new_game(msg, json, user, url){
  let users_in_conversation = _.filter(json, { conversation: user.conversation })
  conversations_active.push({ id: user.conversation, gif: url, captions: {  }, votes: { }, total_votes: 0  })
  for(let j = 0; j < users_in_conversation.length; j++){
    try {
      console.log(users_in_conversation[j])
      sendImage(users_in_conversation[j].unique_id, url)
      sendTextMessage(users_in_conversation[j].unique_id, 'You are playing! Write a caption!')
      // conversations_active[conversations_active.length -1].captions[]
    } catch(err) {
      console.log("User not found: "+users_in_conversation[j].unique_id)
    }
  }
}

function send_photo_to_user(user){
  var conversationIndex = _.findIndex(conversations_active, { id: user.conversation });
  if(conversationIndex !== undefined){
    let url = conversations_active[conversationIndex].gif
    sendImage(user.unique_id, url)
    sendTextMessage(user.unique_id, 'You are playing! Write a caption!!')
  }
}


function from_own_device(tmp){
  if(tmp.hasOwnProperty('message') == true){
    if(tmp.message.hasOwnProperty('is_echo') == false){
      return false
    } else {
      return true
    }
  } else {
    return false
  }
}

function send_voting_options(users_in_conversation, userTmp, conversationIndex) {
  var generic_payload = users_in_conversation.map(function(user, index, arrayValues){
    let text = conversations_active[conversationIndex].captions[user.unique_id]
    let url = conversations_active[conversationIndex].gif
    let payload =  obtain_payload_element(text, url, user)
    return payload
  })
  let payload =[]
  for(var i = 0; i < generic_payload.length; i++){
    if(generic_payload[i].title != undefined){
      payload.push(generic_payload[i])
    }
  }
  console.log('generic_payload yas')
  console.log(payload)
  users_in_conversation = _.filter(users_in_conversation, function(o) { return (o.unique_id !== 'sadas'); } )
  for(let i = 0; i < users_in_conversation.length; i++){
    let user = users_in_conversation[i]
    send_voting_menu(user.unique_id, payload)
  }
}
function parse_msg(req, res){
  let messaging_events = req.body.entry[0].messaging
  for (let i = 0; i < messaging_events.length; i++) {
    let event = req.body.entry[0].messaging[i]
    let sender = event.sender.id
    if(from_own_device(event)){
      continue
    }
    if (event.message && event.message.text) {
      let text = event.message.text
      if (text === 'YASS') {
          // sendGenericMessage(sender)
          // sendImage(sender)
          start(sender).then((data) => {
            var msg = data.msg;
            var json = data.json;
            var user = data.user;
            console.log('Then start')
            console.log(user)
            obtainRandomGif().then((url)=>{
              console.log('obtained randomgif')
              
              switch(msg) {
                case 'Starting a new game':
                  start_new_game(msg, json, user, url)
                  break
                case 'You just joined an existing game!':
                  if(user.current_state == 'sending_photo'){
                    send_photo_to_user(user)
                  } else {
                    sendTextMessage(user.unique_id, msg+' they are in the middle of voting.')
                  }
                  break
                default:
                  sendTextMessage(user.unique_id, 'Hey!')
              }
            }).catch((err)=>{
              console.log(err)
              sendTextMessage(sender, 'Could not obtain gif')
            })
          }).catch((result) => {
            console.log('Catch start')
            sendTextMessage(sender, result)
          });
          continue
      }
      else if (text === 'BYE') {
          // sendGenericMessage(sender)
          // sendImage(sender)
          stop(sender).then((result) => {
            sendTextMessage(sender, result)
          });
          continue
      } else {
        obtain_json().then((json) => {
          let user = _.find(json, { unique_id: sender })
          if(user !== undefined){
            var conversationIndex =_.findIndex(conversations_active, { id: user.conversation });
            if( conversationIndex !== -1 ) {
              console.log('in active conversation '+conversationIndex)
              conversations_active[conversationIndex].captions[user.unique_id] = text;
              console.log(conversations_active);
              // console.log(conversations_active[conversationIndex].captions[user.unique_id])
              sendTextMessage(sender, 'Caption received')

              let users_in_conversation = _.filter(json, { conversation: user.conversation })
              let a = Object.keys(conversations_active[conversationIndex].captions).length
              let b = users_in_conversation.length
              if( (a == b)  || (a == (b - 1)) ){
                console.log('All people sent their captions')
                send_voting_options(users_in_conversation, user, conversationIndex)
              } else {
                console.log('NOt all people sent their captions yet')
                console.log(Object.keys(conversations_active[conversationIndex].captions).length);
                console.log(users_in_conversation.length)
              }
            } else {
              console.log('not in active conversation')
              sendTextMessage(sender, "Text received, echo: " +sender)
            }
          } else {
            console.log('User is undefined')
            console.log(user)
            console.log(sender)
            console.log(json)
          }
        }).catch((err)=>{
          console.log('What is wrong')
          console.log(err)
          sendTextMessage(sender, "Oops something went wrong")
        })
      }
    }
    if (event.postback) {
      obtain_json().then((json) => {
        let voted_for = event.postback.payload;
        let user = _.find(json, { unique_id: sender })
        let conversationIndex = _.findIndex(conversations_active, { id: user.conversation });
        console.log('votoed for')
        console.log(voted_for)
        console.log('iser')
        console.log(user)
        console.log('conversationIndex')
        console.log(conversationIndex)
        
        if(conversations_active[conversationIndex].votes.hasOwnProperty(voted_for)){
          console.log('had previous property')
          conversations_active[conversationIndex].votes[voted_for] += 1;
        } else {
          console.log('setting up to zero')
          conversations_active[conversationIndex].votes[voted_for] = 1;
        }
        conversations_active[conversationIndex].total_votes += 1
        var users_in_conversation = _.filter(json, { conversation: user.conversation });
        // users_in_conversation = _.filter(users_in_conversation, function(o) { return (o.unique_id !== 'sadas'); } )
        let kepts = Object.keys(conversations_active[conversationIndex].votes)
        // let a = conversations_active[conversationIndex]
        // let b = users_in_conversation.length
        if( conversations_active[conversationIndex].total_votes == (users_in_conversation.length - 1) ){
          console.log('conversations_active')
          console.log(conversations_active)
          console.log('everyone is done voting.')
          // send_voting_options(users_in_conversation, user, conversationIndex)
          let winner = '';
          let max = 0;
          for(let k =0; k < kepts.length; k++){
            if(conversations_active[conversationIndex].votes[kepts[k]] > max){
              max = conversations_active[conversationIndex].votes[kepts[k]]
              winner = kepts[k]
            } else {
              console.log('Not big enough')
            }
          }
          if(winner != ''){
            users_in_conversation = _.filter(users_in_conversation, function(o) { return (o.unique_id !== 'sadas'); } )
            let caption = conversations_active[conversationIndex].captions[winner]
            let final = users_in_conversation.map(function(userTmp){
              if(caption == conversations_active[conversationIndex].captions[userTmp.unique_id]){
                sendTextMessage(userTmp.unique_id,'You won!')
              } else {
                sendTextMessage(userTmp.unique_id, caption +' won!')
              }
              return 'yas'
            })
            console.log(final)
            conversations_active = _.filter(conversations_active, function(o){ return ( o.id != user.conversation ) })
            obtainRandomGif().then((url)=>{
              console.log('Starting new game')
              start_new_game('Starting a new game', json, user, url)
            }).catch((err)=>{
              console.log(err)
            })
          } else {
            console.log('Error finding winner')
          }
        } else {
          console.log('NOt all people are done voting')
          console.log('conversations_active')
          console.log(conversations_active)
          console.log(Object.keys(conversations_active[conversationIndex].captions).length);
          console.log(users_in_conversation.length)
          sendTextMessage(sender, "Waiting for other people to finish voting")
        }
      }).catch((err)=>{
        console.log('What is wrong postback')
        console.log(err)
        sendTextMessage(sender, "Oops something went wrong")
      })
    }
  }
  res.sendStatus(200)
}
app.post('/gifwar/webhook/', function (req, res) {
  console.log('inside the webhook')
  parse_msg(req, res)
})
/**
* This should not take any data.
*/
app.listen(3333, function () {
  console.log('THUS SPOKE ZARATHUSTRA')

});

