# PARAMS

PARAMS extracts the values a command needs from the user's request. It runs
after CASE has recognised the command. For "show order 4815", CASE selects the
order command and PARAMS returns the order number. The application can then
open the order screen with that number already applied.

The command supplies the parameters it accepts and, where relevant, the
available values that can be named in text. PARAMS uses the GLiNER2 ONNX model
to find values in the request and match them to those parameters. The same
mechanism handles a direct value such as an order number and a named choice
such as a customer, status, or equipment item.

Together, CASE and PARAMS turn one request into a command and its arguments.
The application receives both parts and performs the usual navigation or
action.
