import * as https from 'https';

import { ILoginService } from "./ILoginService";
import { injectable } from "inversify";

@injectable()
export class LoginService implements ILoginService {
        
  login(username: string, password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      var postData = `username=${username}&password=${password}&stayloggedin=on`;

      var options = {
        hostname: 'localhost',
        port: 8081,
        path: '/login',
        method: 'POST',
        rejectUnauthorized: false,
        requestCert: true,
        agent: false,
        headers: {
             'Content-Type': 'application/x-www-form-urlencoded',
             'Content-Length': postData.length
           }
      };
      
      var req = https.request(options, async (res) => {

        if (res.statusCode && res.statusCode !== 200 && res.statusCode !== 302) {
          reject(`Login failed. Received status code '${res.statusCode}'`);
        }

        var cookies = res.headers["set-cookie"] ?? [];

        if (cookies.length !== 1) {
          reject("Cookie was not set");
          return;
        }
        
        const cookie = cookies[0];

        const startIndex = cookie.indexOf("connect.sid");
        const startSubString = cookie.substring(startIndex);
        const endIndex = startSubString.indexOf(";");
        const connectToken = startSubString.substring(0, endIndex);

        resolve(connectToken);
      });
      
      req.on('error', (e) => {
        reject(e);
      });
      
      req.write(postData);
      req.end();
  });


    }
}