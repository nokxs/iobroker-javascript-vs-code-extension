import * as http from 'http';
import * as https from 'https';

import { ILoginService } from "./ILoginService";
import { Uri } from 'vscode';
import axios from 'axios';
import { injectable } from "inversify";

@injectable()
export class LoginService implements ILoginService {
  
  async isLoginNecessary(baseUri: Uri, allowSelfSignedCertificate: boolean): Promise<boolean> {
    const httpsAgent = new https.Agent({
      rejectUnauthorized: !allowSelfSignedCertificate
    });

    const loginUri = baseUri.with({path: "login"}).toString();
    const result = await axios.get(loginUri, {httpsAgent: httpsAgent});
    
    if (result.status === 200) {
      return true;
    }
    else if(result.status === 302) {
      return false;
    }

    throw new Error(`Could not determine if login was needed, because `);
  }

  login(baseUri: Uri, allowSelfSignedCertificate: boolean, username: string, password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const postData = `username=${username}&password=${password}&stayloggedin=on`;
      const options = this.getLoginPostOptions(baseUri, allowSelfSignedCertificate, postData);
      const req = this.createRequest(baseUri, options, resolve, reject);

      req.on('error', (e) => {
        reject(e);
      });

      req.write(postData);
      req.end();
    });
  }

  private getLoginPostOptions(baseUri: Uri, allowSelfSignedCertificate: boolean, postData: string) {
    const portIndex = baseUri.authority.indexOf(":");
      const hostname = portIndex > 0 ? baseUri.authority.substring(0, portIndex) : baseUri.authority;
      const schemeDefaultPort = baseUri.scheme === "http" ? 80 : 443;
      const port = portIndex > 0 ? baseUri.authority.substring(portIndex + 1) : schemeDefaultPort;

      return {
        hostname: hostname,
        port: port,
        path: '/login',
        method: 'POST',
        rejectUnauthorized: !allowSelfSignedCertificate,
        requestCert: true,
        agent: false,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': postData.length
        }
      };
  }

  private async requestHandler(res: http.IncomingMessage, resolve: (value: string) => void, reject: (reason?: any) => void) {

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
  }

  private createRequest(uri: Uri, options: http.RequestOptions, resolve: (value: string) => void, reject: (reason?: any) => void): http.ClientRequest {
    
    if (uri.scheme === "http") {
      return http.request(options, res => this.requestHandler(res, resolve, reject));
    }

    return https.request(options, res => this.requestHandler(res, resolve, reject));
  }
}