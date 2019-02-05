const request = require('request');
const url = require('url');
const Promise = require('bluebird');

// URLS
// ------
const ACCESS_TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const REGULAR_REDDIT_URL = "https://oauth.reddit.com";

module.exports = function(options) {

	class API {
        constructor(options) {
            this.token_expiration = 0
            this.token = null;
            this.username = options.username;
            this.password = options.password;
            this.app_id = options.app_id;
            this.api_secret = options.api_secret;
            this.user_agent = options.user_agent;

            // Retry on wait
            // If this parameter is present, then if the call errors out due to a "you are doing this too much, try again in: x seconds" error
            // this will automatically hold the application (timeout) until the wait time has finished, and then retries. Only retries once.
            this.retry_on_wait = false;
            if (options.retry_on_wait) {
            	this.retry_on_wait = true;
            }

            // DISABLED FOR NOW. CAUSING ERRORS WHEN USED WITH RETRY ON WAIT.
            // Retry on reddit server error
            // If this parameter is present, then the server will retry on a reddit server error. You can also specify the retry wait duration.
            this.retry_on_server_error = 0;
            this.retry_delay = 5; // Default 5sec retry delay
            if (options.retry_on_server_error) {
            	this.retry_on_server_error = options.retry_on_server_error;
            	if (options.retry_delay) {
            		this.retry_delay = options.retry_delay;
            	}
            }

            // If logs are enabled, default to true.
            this.logs = false;
            if (options.logs) {
            	this.logs = options.logs;
            }
        }

        _logHelper(str) {
        	if (this.logs) {
        		console.log(str);
        	}
        }

        _parseBodyHelper(body_json) {
        	let self = this;
        	var body;
			if (typeof body_json === "string") {
				try {
					body = JSON.parse(body_json);
				} catch(e) {
					self._logHelper("Error parsing JSON body: " + e + " just returning body.");
					body = body_json;
				}
			} else {
				body = body_json;
			}
			return body;
        }

        get_token() {
        	return this._get_token_helper(true);
        }

        _get_token_server_error_looper() {
        	var self = this;
        	return new Promise(function(super_resolve, super_reject) {
				return Promise.mapSeries(new Array(self.retry_on_server_error + 1), function() {
					return new Promise(function(res1, rej1) {
						self._get_token_helper(false)
						.then(function(result) {
							if (result != undefined) {
								return super_resolve(result);
							} else {
								return setTimeout(function() {
									return res1();
								}, self.retry_delay * 1000);
							}
						})
						.catch(function(err) {
							return super_reject(err);
						});
					});
				});
			});
        }

        _get_token_helper(handleErrors) {
        	let self = this;

        	if (Date.now() / 1000 <= self.token_expiration) {
        		return Promise.resolve(self.token);
        	}

			return new Promise(function(resolve, reject) {
				request.post({
					url: ACCESS_TOKEN_URL,
					form: {
						"grant_type": "password",
						"username": self.username,
						"password": self.password
					},
					auth: {
						"user": self.app_id,
						"pass": self.api_secret
					},
					headers: {
						"User-Agent": self.user_agent
					}
				}, (err, res, body) => {
					if (err) {
						return reject("Error getting token: " + err);
					}

					// The status
					let status_class = Math.floor(res.statusCode / 100);

					if (status_class == 2) { // 200 Level so **quickly** return.
						let token_info = self._parseBodyHelper(body);
						self.token_expiration = Date.now() / 1000 + token_info.expires_in / 2;
						self.token = token_info.token_type + " " + token_info.access_token;

						if (token_info.token_type == undefined || token_info.access_token == undefined) {
							self._logHelper("The token retrieved was undefined. The username which we couln't get a token for is: " + self.username);
						}

						return resolve(self.token);
					} else if (status_class == 4) { // Most likely a 403 here
						self._logHelper("Getting token has resulted in: " + res.statusCode + " here. This can originate from not giving this user access in your Reddit App Preferences. Can't obtain token.");
						return resolve(self.token);
					} else if (status_class == 5) { // 503 possibly, server error most likely. do some retries if specified.

						if (self.retry_on_server_error > 0 && handleErrors) {
							self._logHelper("Received server error when trying to get token, attempting " + (self.retry_on_server_error + 1) + " retries.");
							return self._get_token_server_error_looper()
							.then(function(newToken) {
								self.token = newToken;
								return resolve(self.token);
							})
							.catch(function(err) {
								return reject(err);
							});
						} else {

							if (handleErrors) {
								self._logHelper("Getting token has resulted in: " + res.statusCode + " here. Try enabling retries on server errors to automatically retry on this error.");
							}

							return resolve(undefined);
						}
					} else {
						return resolve(self.token);
					}
				})
			});
		}

		_make_request(token, endpoint, method, data, waitingRetryCount, retryOnServerErrorEnabled, retryOn403) {
			let self = this;
			return new Promise(function(resolve, reject) {
				let request_options = {
					url: endpoint,
					method: method,
					headers: {
						"Authorization": token,
						"User-Agent": self.user_agent
					}
				}

				if (method == "GET") {
					request_options.qs = data;
				} else if (method == "PATCH" || method == "PUT" || method == "DELETE") {
					request_options.body = data;
					request_options.json = true;
				} else if (method == "POST") {
					request_options.form = data;
				}

				self._logHelper("Making " + method + " request to: " + endpoint);
				request(request_options, (err, res, body_json) => {
					if (err) {
						return reject("Error making request: " + err);
					}

					// dont parse if its already an object
					var body = self._parseBodyHelper(body_json);

					// The status
					let status_class = Math.floor(res.statusCode / 100);

					self._logHelper("Have gotten a response with the following statusCode: " + res.statusCode);
					switch (status_class) {
						case 1: // Information
							return resolve([res.statusCode, body]);
						case 2: // Success
							if (body && body.json && body.json.ratelimit) {

								var retryingSec = body.json.ratelimit;
								if (retryingSec > 0 && self.retry_on_wait && waitingRetryCount == 0) {
									self._logHelper("Retrying [in " + retryingSec + " seconds] making request due to ratelimit.");
									return setTimeout(function() {
										// Retry this now that the wait is complete.
										return self._make_request(token, endpoint, method, data, waitingRetryCount + 1, true, true)
										.then(function(results) {
											return resolve(results);
										})
										.catch(function(err) {
											return reject(err);
										});
									}, retryingSec * 1000);

								} else {
									return reject("you are doing this too much, try again in: " + body.json.ratelimit + " seconds");
								}
							} else {
								return resolve([res.statusCode, body]);
							}
						case 3: // Redirection
							return resolve([res.statusCode, body]);
						case 4: // Client error

							// If this is a 403 (Forbidden) usually means that the access token has expired, so get a new token and retry.
							if (res.statusCode == 403 && retryOn403) {
								self._logHelper("Encountered 403, retrying after grabbing new token.");
								return self.get_token()
								.then(function(tkn) {
									return self._make_request(tkn, endpoint, method, data, waitingRetryCount, retryOnServerErrorEnabled, false)
									.then(function(results) {
										return resolve(results);
									})
									.catch(function(err) {
										return reject(err);
									});
								})
								.catch(function(err) {
									return reject(err);
								});
							} else if (res.statusCode == 403) {
								return reject("Received two 403's in a row. Not retrying again.");
							}

							return resolve([res.statusCode, body]);
						case 5: // Server Error

							if (self.retry_on_server_error > 0 && retryOnServerErrorEnabled) {
								return self._make_request_helper(token, endpoint, method, data)
								.then(function(results) {
									return resolve(results);
								})
								.catch(function(err) {
									return reject(err);
								})
							} else {
								return reject("server error has occured: " + res.statusCode + " and body: " + body);
							}
						default:
							return reject("Shouldn't have reached here. StatusCode: " + res.statusCode + " and Body: " + body);
					}
				});
			});
		}

		_make_request_helper(token, endpoint, method, data) {
			let self = this;
			return new Promise(function(super_resolve, super_reject) {
				return Promise.mapSeries(new Array(self.retry_on_server_error + 1), function() {
					return new Promise(function(resolve, reject) {
						self._make_request(token, endpoint, method, data, 0, false, true)
						.then(function(results) {
							return super_resolve(results);
						})
						.catch(function(err) {
							var errSplit = err.toString().split("server error");
							if (errSplit.length >= 2) {
								// Continue (aka try again) 
								return setTimeout(function() {
									self._logHelper("Got Server Error. Retrying Request.");
									return resolve();
								}, self.retry_delay * 1000);
							}

							self._logHelper("This should not be reached! Please report a bug!");
							return resolve();
						});
					});
				})
				.then(function(results) {
					return super_reject("Did not succeed after numerous attempts.");
				})
				.catch(function(err) {
					return super_reject(err);
				});
			});
		}

		_method_helper(endpoint, data, URL, METHOD) {
			let self = this;
			return new Promise(function(resolve, reject) {
				self.get_token()
				.then(function(token) {
					return self._make_request(token, URL + endpoint, METHOD, data, 0, true, true);
				})
				.then(function(results) {
					// Returning [resultCode, body]
					return resolve(results);
				})
				.catch(function(err) {
					return reject(err);
				});
			});
		}

		get(endpoint, data) {
			let METHOD = "GET";
			let URL = REGULAR_REDDIT_URL;
			return this._method_helper(endpoint, data, URL, METHOD);
		}

		post(endpoint, data) {
			let METHOD = "POST";
			let URL = REGULAR_REDDIT_URL;
			return this._method_helper(endpoint, data, URL, METHOD);
		}

		patch(endpoint, data) {
			let METHOD = "PATCH";
			let URL = REGULAR_REDDIT_URL;
			return this._method_helper(endpoint, data, URL, METHOD);
		}

		put(endpoint, data) {
			let METHOD = "PUT";
			let URL = REGULAR_REDDIT_URL;
			return this._method_helper(endpoint, data, URL, METHOD);
		}

		del(endpoint, data) {
			let METHOD = "DELETE";
			let URL = REGULAR_REDDIT_URL;
			return this._method_helper(endpoint, data, URL, METHOD);
		}
	}

	return new API(options);
}
