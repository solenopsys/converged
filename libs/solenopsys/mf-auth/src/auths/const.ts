const options = {
	client_id: '839277684918-b4ji9lbh0a2t3qi48t9b9mb0r027l20a.apps.googleusercontent.com', // required
	auto_select: this, // optional
	cancel_on_tap_outside: false, // optional
	context: 'signin', // optional
};


googleOneTap(options, (response: { credential: string }) => {
    console.log("GOOGLE AUTH", response);
    // Send response to server

    const jwt = localStorage.getItem("jwt");
    const decoded = jwtDecode(response.credential);

    console.log(decoded);
});

import { googleOneTap } from "./gin";
import { jwtDecode } from "jwt-decode";