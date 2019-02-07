declare module 'reddit-wrapper-v2' {
  import * as Bluebird from 'bluebird'

  export interface IRedditAPIOptions {
    /** The Username for the Reddit Account. (Required) */
    username: string
    /** The Password for the Reddit Account. (Required) */
    password: string
    /** The Reddit Application ID. (Required) */
    app_id: string
    /** The Reddit Application Secret. (Required) */
    api_secret: string
    /** The User Agent for all Reddit API requests. (defaults to "Reddit-Watcher-V2") */
    user_agent?: string
    /** If True and Reddit returns a "You are trying this too much" error, it will pause the process for the exact time needed, then retry the request. (Defaults to false) */
    retry_on_wait?: boolean
    /** If > 0 and Reddit returns a server error (responseCode >= 500 && responseCode <= 599) it will retry the request the number of times you specify + 1 automatically. (Defaults to 0) */
    retry_on_server_error?: number
    /** Specifies the retry delay for server error retries. (IE. if server error and you specify you want to retry before retrying it will delay for retry_delay seconds.) (Defaults to 5 sec.) */
    retry_delay?: number
    /** Display logs. (Defaults to false) */
    logs?: boolean
  }

  export type APIResponse = [number, any]

  class API {
    constructor(options: IRedditAPIOptions)
  
    get(endpoint: string, data?: any): Bluebird<APIResponse>
    post(endpoint: string, data?: any): Bluebird<APIResponse>
    patch(endpoint: string, data?: any): Bluebird<APIResponse>
    put(endpoint: string, data?: any): Bluebird<APIResponse>
    del(endpoint: string, data?: any): Bluebird<APIResponse>
  }

  export default function(options: IRedditAPIOptions): { api: API }
}

