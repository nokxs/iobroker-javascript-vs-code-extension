/*!
 * ioBroker WebSockets
 * Copyright 2020-2021, bluefox <dogafox@gmail.com>
 * Released under the MIT License.
 * v 0.2.1 (2020_10_16)
 */
/* jshint -W097 */
/* jshint strict: false */
/* jslint node: true */
/* jshint -W061 */
'use strict';

// const ERRORS = {
//     1000: 'CLOSE_NORMAL',	        // Successful operation / regular socket shutdown
//     1001: 'CLOSE_GOING_AWAY',	    // Client is leaving (browser tab closing)
//     1002: 'CLOSE_PROTOCOL_ERROR',	// Endpoint received a malformed frame
//     1003: 'CLOSE_UNSUPPORTED',		// Endpoint received an unsupported frame (e.g. binary-only endpoint received text frame)
//     1005: 'CLOSED_NO_STATUS',		// Expected close status, received none
//     1006: 'CLOSE_ABNORMAL',		    // No close code frame has been received
//     1007: 'Unsupported payload',	// Endpoint received inconsistent message (e.g. malformed UTF-8)
//     1008: 'Policy violation',	    // Generic code used for situations other than 1003 and 1009
//     1009: 'CLOSE_TOO_LARGE',	    // Endpoint won't process large frame
//     1010: 'Mandatory extension',	// Client wanted an extension which server did not negotiate
//     1011: 'Server error',	        // Internal server error while operating
//     1012: 'Service restart',	    // Server/service is restarting
//     1013: 'Try again later',	    // Temporary server condition forced blocking client's request
//     1014: 'Bad gateway	Server',    // acting as gateway received an invalid response
//     1015: 'TLS handshake fail',		// Transport Layer Security handshake failure
// };
export interface ISocketIoClient {
    connected: boolean;

    connect(_url: any, _options: any): ISocketIoClient;
    withCallback(name: String, id: any, args: any, cb: any): void;
    findAnswer(id: any, args: any): void;
    emit(name: string, arg1?: any, arg2?: any, arg3?: any, arg4?: any, arg5?: any): void;
    on(name: any, cb: any): void;
    off(name: any, cb?: any): void;
    close(): ISocketIoClient;
}
