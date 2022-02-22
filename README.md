# TeslaAuthJS
JS translation of TeslaAuth C# code.  Full credit goes to the author of the C# library (https://github.com/tomhollander/TeslaAuth/).

This is essentially a direct translation of that library from C# to JS.

## Notes 
- The non-CAPTCHA (web view) version basically never works anymore, so I've only translated the "web view" pieces of the code.  
- Easiest way to use is within an Electron app, or similar, where you have 'native' presentation of a web view.

## High Level Usage Overview
- Show the user the URL returned by: GetLoginUrlForBrowser()
- Monitor browser location until it is something like "https://auth.tesla.com/void/callback?code=XXX"
- Call GetTokenAfterLoginAsync() with browser window URL [like the above] provided as first arg
- The callback will contain the 'final token data' which is what you'll use to authenticate any/all future requests.


## Using the Authentication Token
Make your API calls with the following header:  
    "Authorization: Bearer " + TOKEN_DATA.authToken
    
## Enjoy!
Feel free to submit PRs to add functionality or improve code quality, etc...  I'm not a JS developer by day so the code may be awful or not make use of the latest best practices, or similar.  

Use at your own risk -- and feel free to submit improvmeents!  :)