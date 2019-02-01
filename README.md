
# Reddit-Wrapper-V2 - Reddit API framework for Nodejs

## Simple to use
Reddit-Wrapper is designed to be a simple to user reddit API wrapper, while also providing robust error handling and retry capabilities. Every function returns a promise. Allowing the user to easily handle errors in the catch, and results in the then.

``` js
	reddit.api.get("/subreddits/mine/subscriber", {
			limit: 2,
	}) 
    .then(function(response) {
	    let responseCode = response[0];
	    let responseData = response[1];

		console.log("Received response (" + responseCode + "): ", responseData);
	})
	.catch(function(err) {
	});
```


## Table of Contents
- [Setup and Configuration](#setup-and-configuration)
- [Api](#reddit-api-snooperapi)

## Setup and Configuration
### Installing reddit-snooper
``` bash
npm install reddit-wrapper --save
```

### Library usage and configuration
``` js
var RedditAPI = require('reddit-wrapper');

var redditConn = new RedditAPI(
        {
            // credential information is not needed for snooper.watcher
            // Required values:
            username: 'reddit_username',
            password: 'reddit password',
            app_id: 'reddit api app id',
            api_secret: 'reddit api secret',

			// Optional values
            user_agent: 'user agent for your bot',
			
		// Retry on Wait tells the API Wrapper that whenever reddit replies with the message
		// "You are doing this too much, try again". To sleep the process until the second 
		// after reddit will allow posting, and then post again. (This is a hard sleep).
		retry_on_wait: true, // Default: false
			
		// Retry on Server Error tells the wrapper to retry making requests a certain amount
		// of times, if a reddit server error is encountered (Ie. "Ow. Please try again.").
		// Specifying 5 times will attempt the request a MAXIMUM of 6 times. 
		retry_on_server_error: 5, // Default: 0
			
		// Retry Delay specifies the delay between server error retries. The unit is seconds.
		retry_delay: 1, // Default: 5 seconds.
        })
```

### API setup 
All you need to get up and running is obtain an api_id and an api_secret. Both can be created on the [Reddit app console](https://reddit.com/prefs/apps)
1. Create (or log into) a reddit account
2. Navigate to the [authorized applications console](https://reddit.com/prefs/apps)
3. Select 'create another app...' at the bottom
4. Fill in the name, description and click on 'script', put in anything for the redirect uri, its not needed and you can change it later if you want to
5. Copy down the 'secret' that is your api_secret, the 14 character string by the name of your app is your app_id
6. Use these values and your credentials to configure the snooper

## Reddit API (api)

Reddit Wrappers api component is an agnostic wrapper around Reddit's rest API that handles retries, and Reddit's different response codes.

In order to use the api head over to the [Reddit API Documentation](https://www.reddit.com/dev/api/). All of the api methods use one of the 5 HTTP methods (GET, POST, PATCH, PUT, DELETE) which map to the 5 different snooper.api methods. 

``` js
// endpoint: api endpoint ex: 'api/v1/me' or '/api/v1/me/karma/' (listed on api documentation)
// data: JSON data, dependent on the request which is specified in the docs
// NOTE: the function .get is used for api calls that use HTTP GET, you can find the method each api endpiont uses on (you guessed it) the reddit api docs

// HTTP GET
redditWrapper.api.get(endpoint, data)
.then(function(response) {
	let responseCode = response[0];
	let responseData = response[1];

	console.log("Received response (" + responseCode + "): ", responseData);
})
.catch(function(err) {
	return console.error("api request failed: " + err)
});
    
// HTTP POST
redditWrapper.api.post(endpoint, data)
.then(function(response) {})
.catch(function(err) {})

// HTTP PATCH
redditWrapper.api.patch(endpoint, data)
.then(function(response) {})
.catch(function(err) {})

// HTTP PUT
redditWrapper.api.put(endpoint, data)
.then(function(response) {})
.catch(function(err) {})

// HTTP DELETE
redditWrapper.api.delete(endpoint, data)
.then(function(response) {})
.catch(function(err) {})

// gets an api token 
redditWrapper.api.get_token()
.then(function(token) {})
.catch(function(err) {})

```

*Note: new accounts get little to no posting privileges (1 comment or post per 5 minutes or more) if you dont have any karma. If you just want to play around with the api I recommend using an active account.*
*Note: the response from any HTTP methods will be an array containing [responseCode, data].*


### basic api usage

check how much karma your bot has
``` js
redditWrapper.api.get('api/v1/me/karma', {})
.then(function(resp) {
	let responseCode = response[0];
	let responseData = response[1];
    console.log("I have " + responseData.karma + " karma")
})
.catch(function(err) {
	console.log("Error getting karma: ", err);
})
```

post a comment
``` js
redditWrapper.api.post("/api/comment", {
    api_type: "json",
    text:     "Hello World"
    thing_id: comment.data.name
})
.then(function(resp) {
	let responseCode = response[0];
	let responseData = response[1];
	
	console.log("Posted comment!");
})
.catch(function(err) {
	console.log("Error posting comment: ", err);
})

```


## Final Notes
- This was largely based on the reddit-snooper library. However that is no longer maintained.
- This relies on Bluebird promises.
- Feel free to make feature requests, bugs, etc. I will try to be as prompt at fixing/getting back to you.