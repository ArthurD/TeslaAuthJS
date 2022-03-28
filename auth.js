    // Helper library to authenticate to Tesla Owner API.  Includes support for MFA.
    const axios = require('axios');
    const sha256 = require("js-sha256");
    const URLSafeBase64 = require('urlsafe-base64');
    const TESLA_CLIENT_ID = "81527cff06843c8634fdc09e8ac0abefb46ac849f38fe1e431c2ef2106796384";
    const TESLA_CLIENT_SECRET = "c7257eb71a564034f9419ee651c7d0e5f7aa6bfbd18bafb5c5c033b093bb2fa3";
    const DEBUG = false;
    const DEBUG_ERRORS = false;

    let loginInfo = {
        CodeVerifier: "",
        CodeChallenge: "",
        State: "",
    };

    // Constructor and HttpClient initialisation
    function Init() {
        loginInfo.CodeVerifier = RandomString(86);
        loginInfo.State = RandomString(20);
    }
    
    function DebugError(msg) { 
        if(DEBUG_ERRORS) {
            console.log(msg);
        }
    }
    
    function DebugLog(msg) { 
      if(DEBUG) { 
        console.log(msg);
      }
    }
    
    function GetStandardHeaders() {
        let x = {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'User-Agent': 'TeslaAuthJS/1.0',
            }
        };
        return x;
    }

    // Public API for browser-assisted auth
    function GetLoginUrlForBrowser() {
        Init();
        loginInfo.CodeChallenge = ComputeSHA256Hash(loginInfo.CodeVerifier);

        let url = new URL(GetBaseAddressForRegion("USA") + "/oauth2/v3/authorize");
        url.searchParams.append('client_id', 'ownerapi');
        url.searchParams.append('code_challenge', loginInfo.CodeChallenge);
        url.searchParams.append('code_challenge_method', 'S256');
        url.searchParams.append('redirect_uri', 'https://auth.tesla.com/void/callback');
        url.searchParams.append('response_type', 'code');
        url.searchParams.append('scope', 'openid email offline_access');
        url.searchParams.append('state', loginInfo.State);
        return url.toString();
    }

    //public async Task<Tokens> GetTokenAfterLoginAsync(string redirectUrl, CancellationToken cancellationToken = default) {
    function GetTokenAfterLoginAsync(redirectUrl, callback) {
        // URL is something like https://auth.tesla.com/void/callback?code=b6a6a44dea889eb08cd8afe5adc16353662cc5d82ba0c6044c95b13d6f…"
        let code = new URL(redirectUrl).searchParams.get('code');

        ExchangeCodeForBearerTokenAsync(code, function (results) {
            DebugLog("AFTER ExchangeCodeForBearerTokenAsync -- our results are:");
            DebugLog(results);
            callback({
                AccessToken: results.access_token,
                RefreshToken: results.refresh_token,
                CreatedAt: results.id_token,
                ExpiresIn: results.expires_in,
                State: results.state,
                TokenType: results.token_type
            });
        
            // As of March 21 2022, the above already returns a bearer token.  No need to call ExchangeAccessTokenForBearerToken anymore [for now]
            // ExchangeAccessTokenForBearerTokenAsync(results.AccessToken, function (accessAndRefreshTokens) {
            //   let final_token_data = {
            //     AccessToken: accessAndRefreshTokens.AccessToken,
            //     RefreshToken: results.RefreshToken,
            //     CreatedAt: accessAndRefreshTokens.CreatedAt,
            //     ExpiresIn: accessAndRefreshTokens.ExpiresIn
            //   };
            //   callback(final_token_data);
            // });
        });
    }
    

    function RefreshTokenAsync(refreshToken, callback) {
        
        let url = GetBaseAddressForRegion("USA") + "/oauth2/v3/token";
        let body = [
            {"grant_type": "refresh_token"},
            {"client_id": "ownerapi"},
            {"refresh_token": refreshToken},
            {"scope": "openid email offline_access"}
        ];

        axios.post(url, JSON.stringify(body), GetStandardHeaders()).then(webResponse => {
            DebugLog("sent POST request " + url + "\ngot response:\n" + webResponse);
            
            callback({
                AccessToken: webResponse.data['access_token'],
                RefreshToken: webResponse.data['refresh_token'],
                ExpiresIn: webResponse.data['expires_in']
            });
            
            // As of March 21 2022, this returns a bearer token.  No need to call ExchangeAccessTokenForBearerToken ... for now.
        }).catch(function (e) {
            DebugLog("error submitting request...!  0000 \n" + e.toString());
        });
    }

    function ExchangeCodeForBearerTokenAsync(code, callback) {
        let body = {
            "grant_type": "authorization_code",
            "client_id": "ownerapi",
            "code": code,
            "code_verifier": loginInfo.CodeVerifier,
            "redirect_uri": "https://auth.tesla.com/void/callback"
        };

        let url = GetBaseAddressForRegion("USA") + "/oauth2/v3/token";
        axios.post(url, JSON.stringify(body), GetStandardHeaders()).then(webResponse => {
            DebugLog("sent POST request " + url + "\ngot response:");
            DebugLog(webResponse.data);
            callback(webResponse.data);
            
        }).catch(function (e) {
            DebugError("error submitting request...! "+url+"\n  1111\n" + e.toString() + "\n"+JSON.stringify(body));
        });
    }

    // NO LONGER USED/NEEDED AS OF MARCH 21 2022
    function ExchangeAccessTokenForBearerTokenAsync(accessToken, callback) {
        let body = {
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "client_id": TESLA_CLIENT_ID,
            "client_secret": TESLA_CLIENT_SECRET,
        };

        let url = "https://owner-api.teslamotors.com/oauth/token";
        let headers = GetStandardHeaders();
        headers['headers']['Authorization'] = 'Bearer ' + accessToken;
        
        axios.post(url, JSON.stringify(body), headers).then(webResponse => {
            // var createdAt = ; //DateTimeOffset.FromUnixTimeSeconds(response["created_at"]!.Value<long>());
            // var expiresIn = ; //TimeSpan.FromSeconds(response["expires_in"]!.Value<long>());
            // var bearerToken = ; //!.Value<string>();
            // var refreshToken = ; //!.Value<string>();

            let resultData = {
                AccessToken: webResponse.data["access_token"],
                RefreshToken: webResponse.data["refresh_token"],
                CreatedAt: webResponse.data["created_at"],
                ExpiresIn: webResponse.data["expires_in"]
            };

            DebugLog("result data...");
            DebugLog(resultData);
            callback(resultData);
        }).catch(function (err) {
            DebugError("error submitting request...! 2222\n" + err.toString());
        });
    }

    /// <summary>
    /// Should your Owner API token begin with "cn-" you should POST to auth.tesla.cn Tesla SSO service to have it refresh. Owner API tokens
    /// starting with "qts-" are to be refreshed using auth.tesla.com
    /// </summary>
    /// <param name="region">Which Tesla server is this account created with?</param>
    /// <returns>Address like "https://auth.tesla.com", no trailing slash</returns>
    function GetBaseAddressForRegion(region) {
        switch (region) {
            case "China":
                return "https://auth.tesla.cn";
            default:
                return "https://auth.tesla.com";
        }
    }

    function RandomString(length) {
        const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let result = '';
        for (let i = length; i > 0; --i) {
            result += chars[Math.floor(Math.random() * chars.length)];
        }
        return result;
    }

    function ComputeSHA256Hash(text) {
        return URLSafeBase64.encode(sha256(text));
    }

    let auth = {
        GetLoginUrlForBrowser,
        GetTokenAfterLoginAsync
    };

module.exports = { auth };