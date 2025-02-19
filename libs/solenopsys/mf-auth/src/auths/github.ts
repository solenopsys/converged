// Replace these with your GitHub app credentials
const clientId = "YOUR_CLIENT_ID";
const clientSecret = "YOUR_CLIENT_SECRET";

// The URL where the user will be redirected after authentication
const redirectUrl = "/auth/callback";

// Generate the authentication URL
const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUrl}`;
console.log(`Visit this URL to authenticate: ${authUrl}`);

// After the user is redirected to the callback URL with the code,
// you can exchange the code for an access token:
const code = "THE_CODE_FROM_REDIRECT_URL";
const tokenUrl = "https://github.com/login/oauth/access_token";

const body = new URLSearchParams({
	client_id: clientId,
	client_secret: clientSecret,
	code,
	redirect_uri: redirectUrl,
});

fetch(tokenUrl, {
	method: "POST",
	headers: {
		"Content-Type": "application/x-www-form-urlencoded",
		Accept: "application/json",
	},
	body,
})
	.then((response) => response.text())
	.then((text) => {
		const params = new URLSearchParams(text);
		const accessToken = params.get("access_token");
		console.log(`Access token: ${accessToken}`);
	})
	.catch((error) => console.error(error));
