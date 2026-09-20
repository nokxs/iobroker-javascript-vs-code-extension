export enum LoginType {
    // No login is necessary, because authentication is not enabled in admin
    noLogin,

    // Has to be used if admin version is < 7.6.2
    legacy,

    // Has to be used if admin version is >= 7.6.2
    oAuth2
}