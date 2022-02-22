    const axios = require('axios');
    const sha256 = require("js-sha256");
    const URLSafeBase64 = require('urlsafe-base64');
    const TESLA_CLIENT_ID = "81527cff06843c8634fdc09e8ac0abefb46ac849f38fe1e431c2ef2106796384";
    const TESLA_CLIENT_SECRET = "c7257eb71a564034f9419ee651c7d0e5f7aa6bfbd18bafb5c5c033b093bb2fa3";

    let loginInfo = {
        CodeVerifier: "",
        CodeChallenge: "",
        State: "",
    };

    // Initialisation
    function Init() {
        loginInfo.CodeVerifier = RandomString(86);
        loginInfo.State = RandomString(20);
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

    function GetTokenAfterLoginAsync(redirectUrl, callback) {
      
        // URL is something like https://auth.tesla.com/void/callback?code=b6a6a44dea889eb08cd8afe5adc16353662cc5d82ba0c6044c95b13d6f…"
        let code = new URL(redirectUrl).searchParams.get('code');

        ExchangeCodeForBearerTokenAsync(code, function (results) {
            ExchangeAccessTokenForBearerTokenAsync(results.AccessToken, function (accessAndRefreshTokens) {
                // console.log("final results...");
                let final_token_data = {
                    AccessToken: accessAndRefreshTokens.AccessToken,
                    RefreshToken: results.RefreshToken,
                    CreatedAt: accessAndRefreshTokens.CreatedAt,
                    ExpiresIn: accessAndRefreshTokens.ExpiresIn
                };
                // console.log(final_token_data);
                callback(final_token_data);
            });
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

        axios.post(url, JSON.stringify(body),
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'TeslaAuthJS/1.0',
                }
            }
        ).then(webResponse => {
            // console.log("sent POST request " + url + "\ngot response:\n" + webResponse);

            let newTokens = ExchangeAccessTokenForBearerTokenAsync(webResponse.data["access_token"]);
            newTokens.RefreshToken = webResponse.data["refresh_token"];

            callback(newTokens);
        }).catch(function (e) {
            // console.log("error submitting request...!  0000 \n" + e.toString());
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
        axios.post(url, JSON.stringify(body),
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'TeslaAuthJS/1.0',
                }
            }
        ).then(webResponse => {
          // console.log("sent POST request " + url + "\ngot response:");
          // console.log(webResponse.data);

            let final = {
                AccessToken: webResponse.data["access_token"],
                RefreshToken: webResponse.data["refresh_token"],
            };
            callback(final);
        }).catch(function (e) {
            // console.log("error submitting request...! "+url+"\n  1111\n" + e.toString() + "\n"+JSON.stringify(body));
        });


    }

    function ExchangeAccessTokenForBearerTokenAsync(accessToken, callback) {
        let body = {
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "client_id": TESLA_CLIENT_ID,
            "client_secret": TESLA_CLIENT_SECRET,
        };

        let url = "https://owner-api.teslamotors.com/oauth/token";
        axios.post(url, JSON.stringify(body),
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'TeslaAuthJS/1.0',
                    'Authorization': 'Bearer ' + accessToken,
                }
            }
        ).then(webResponse => {
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

            // console.log("result data...");
            // console.log(resultData);
            callback(resultData);
        }).catch(function (err) {
            // console.log("error submitting request...! 2222\n" + err.toString());
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