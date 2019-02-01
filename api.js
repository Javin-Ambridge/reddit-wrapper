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
        }

        get_token() {
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

					let token_info = JSON.parse(body);
					self.token_expiration = Date.now() / 1000 + token_info.expires_in / 2;
					self.token = token_info.token_type + " " + token_info.access_token;
					return resolve(self.token);
				})
			});
		}

		_make_request(token, endpoint, method, data) {
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

				request(request_options, (err, res, body_json) => {
					if (err) {
						return reject("Error making request: " + err);
					}

					// dont parse if its already an object
					let body = (typeof body_json === "string") ? JSON.parse(body_json) : body_json;

					// The status
					let status_class = Math.floor(res.statusCode / 100);

					switch (status_class) {
						case 1: // Information
							return resolve([res.statusCode, body]);
						case 2: // Success
							if (body && body.json && body.json.ratelimit) {
								return reject("you are doing this too much, try again in: " + body.json.ratelimit + " seconds", res.statusCode, body);
							} else {
								return resolve([res.statusCode, body]);
							}
						case 3: // Redirection
							return resolve([res.statusCode, body]);
						case 4: // Client error
							return resolve([res.statusCode, body]);
						case 5: // Server Error
							return reject("server error has occured: " + res.statusCode + " and body: " + body);
						default:
							return reject("Shouldn't have reached here. StatusCode: " + res.statusCode + " and Body: " + body);
					}
				});
			});
		}

		_make_request_helper(token, endpoint, method, data) {
			let self = this;
			if (self.retry_on_server_error > 0) {
				return new Promise(function(super_resolve, super_reject) {
					return Promise.mapSeries(new Array(self.retry_on_server_error + 1), function() {
						return new Promise(function(resolve, reject) {
							self._make_request(token, endpoint, method, data)
							.then(function(results) {
								return super_resolve(results);
							})
							.catch(function(err) {
								var errSplit = err.toString().split("server error");
								if (errSplit.length >= 2) {
									// Continue (aka try again) 
									setTimeout(function() {
										console.log("Got Server Error. Retrying Request.");
										resolve();
									}, self.retry_delay * 1000);
								}
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
			} else {
				return self._make_request(token, endpoint, method, data);
			}
		}

		_method_helper_no_wait(endpoint, data, URL, METHOD) {
			let self = this;
			return new Promise(function(resolve, reject) {
				self.get_token()
				.then(function(token) {
					return self._make_request_helper(token, URL + endpoint, METHOD, data);
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

		_method_helper_hard_wait(endpoint, data, URL, METHOD) {
			let self = this;
			return new Promise(function(resolve, reject) {
				self.get_token()
				.then(function(token) {
					return self._make_request_helper(token, URL + endpoint, METHOD, data);
				})
				.then(function(results) {
					// Returning [resultCode, body]
					return resolve(results);
				})
				.catch(function(err) {
					var errSplit = err.toString().split("try again in: ");
					var retryingSec = -1;
					if (errSplit.length == 2) { // Error we are going to retry for
						var errSplit2 = errSplit[1].split(" seconds");
						if (errSplit2.length >= 1) {
							retryingSec = Math.ceil(parseFloat(errSplit2[0]));
						}
					}

					if (retryingSec > 0) {
						console.log("Retrying [in " + retryingSec + " seconds] making request due to this error: ", err);
						setTimeout(function() {

							// Retry this now that the wait is complete.
							return self._method_helper_no_wait(endpoint, data, URL, METHOD)
							.then(function(results) {
								return resolve(results);
							})
							.catch(function(err) {
								return reject(err);
							});

						}, retryingSec * 1000);
					} else {
						return reject(err);
					}
				});
			});
		}

		_method_helper(endpoint, data, URL, METHOD) {
			let self = this;
			if (this.retry_on_wait) {
				return self._method_helper_hard_wait(endpoint, data, URL, METHOD);
			} else {
				return self._method_helper_no_wait(endpoint, data, URL, METHOD);
			}
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
