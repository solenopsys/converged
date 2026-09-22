# CASE

CASE interprets a user's request as a platform command. It receives the set of
commands the platform can run and examples of the phrases that express each
one. From "show equipment" it selects the command that opens the equipment
list. From "show order 4815" it selects the command that opens an order.

The service compares the request with the command examples and returns the
selected command with a score. `EXECUTE` means that one command was recognised
clearly enough to run. `AMBIGUOUS` means that several commands are too close
to choose between. `UNKNOWN` means that the request does not match the command
set.

CASE chooses what the user is asking to do. It does not extract the details of
that request. When a command needs them, PARAMS reads the same text and returns
the values needed to open or filter the result: in "show order 4815", CASE
chooses the order command and PARAMS extracts `4815`.
