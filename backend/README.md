# TARADAS backend

Backend infrastructure and authorization work for the TARADAS admin application belongs in this folder.

Security note: AWS access keys must never be committed to this repository or stored in source files. Use the AWS CLI profile, environment-based credentials, or an approved secret manager.

Planned backend responsibilities:

- Cognito group-based authorization (`admins` and `users`)
- AppSync schema and resolver authorization
- Server-side validation for customer, scheme, payment, rate, and withdrawal operations
- Audit logging for administrative actions
- Customer login identifiers use the short unique format `CUSXXXXXXXX` and are intended to be Cognito usernames.

## Live AWS resources

- Account: `912243546333`
- Region: `ap-south-1`
- User Pool: `ap-south-1_BCnpX8nNg`
- AppSync API: `TaradasJewelryAPI`
- AppSync API ID: `maiunmmca5acvlqsv7yhsnwrci`
- Sign-up resolver Lambda: `TDSignUpHandler_dev`

The live AppSync schema currently uses Cognito User Pool authentication but does not expose group directives in its introspected SDL. Admin authorization must therefore be added either to the schema/resolver configuration or enforced in the Lambda handlers using `event.identity.claims['cognito:groups']`.
