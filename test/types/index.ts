import { Promise } from 'bluebird';
import redditWrapper, { IRedditAPIOptions, APIResponse } from 'reddit-wrapper-v2'

// All API Options
const options: IRedditAPIOptions = {
  api_secret: '',
  app_id: '',
  username: '',
  password: '',
  user_agent: '',
  retry_on_wait: false,
  retry_on_server_error: 0,
  retry_delay: 0,
  logs: false
}

/**
 * We just need to satisfy typescript with correct types, so we're enclosing 
 * the code to a function and never run it.
 */
function enclose() {
  // Include all possible options.
  const r1 = redditWrapper(options)

  // Include only required options.
  const r2 = redditWrapper({
    app_id: options.app_id,
    api_secret: options.api_secret,
    username: options.username,
    password: options.password
  })

  // HTTP Methods.
  const onFulfill = (responses: APIResponse[]) => null
  const onReject = (err: any) => null

  Promise.all([
    r1.api.get('', {}),
    r1.api.post('', {}),
    r1.api.patch('', {}),
    r1.api.put('', {}),
    r1.api.del('', {})
  ]).then(onFulfill).catch(onReject)
}
