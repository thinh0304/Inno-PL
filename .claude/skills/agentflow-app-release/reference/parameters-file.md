# The parameters file

`--parameters parameters.json` is a JSON object by parameter key, and **a parameter you leave out is answered by
the admin on the setup page**, so `{}` is a valid file. Write only what you know; a wrong id is a wrong install.

| Parameter `type` | Value in the file | Where a person finds it |
|---|---|---|
| `group_ref`, `user_ref`, `service_principal_ref` | the object's id, a UUID string | open it in **Admin → Groups**, **Users** or **Service principals**: the id is the last part of the page's address, such as `<AGENTFLOW_URL>/admin/groups/<id>` |
| `unit_ref` | a unit's id | `GET <AGENTFLOW_URL>/api/v1/units` with a key of the organization lists them with their ids (so do `/groups` and `/users`) |
| `secret_ref`, `sla_policy_ref`, `escalation_policy_ref` | the object's id | no page shows it: leave these out and let the admin choose on the setup page |
| `connection_ref` | only the pair `{"provider": "<provider>", "externalAccountId": "<account>"}`, with the provider of the connection (`resend` for an email step's connection, `hubspot` for a HubSpot integration or connected app): setup refuses a bare connection id where the parameter fills an email step's connection, an Integration step's `connection`, a trigger's `config.account` or an entity's `source.connection` | no page shows the value. Leave it out: the admin picks the connection on the setup page, or copy the pair from the **Parameters file** that page downloads |
| `text`, `number` | a string, a number | you decide |
| `enum` | one of the parameter's `options` | you decide |

Ids are easiest from the admin: once they have chosen on the setup page, **Parameters file** downloads the same
object, which you can keep for CI.

```json
{ "app_users": "0190f8f4-aaaa-7000-8000-000000000001", "it_group": "0190f8f4-aaaa-7000-8000-000000000002" }
```

An id that names nothing in the organization shows on the setup page as an item that needs a fix.
