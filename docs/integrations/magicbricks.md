# Magicbricks push integration

Status: implemented in source; configure and deploy the backend before sharing the production endpoint as live.

Same request and response as the [99acres integration](99acres.md), with its own URL. It currently uses the same key as 99acres, set separately as `MAGICBRICKS_API_KEY` so it can be changed without touching 99acres.

## Request

- Method: `POST`
- Production URL after deployment: `https://api.prismark.in/api/v1/leads/magicbricks`
- `Content-Type: application/json`
- `X-API-Key: <integration key shared separately>`
- No CRM login/JWT is needed. The website service key is not accepted.
- One to 100 leads per request, at most 512 KB.
- Use the JSON envelope below. Each lead has only name, mobile, optional email, and optional remarks.

```json
{
  "leads": [
    {
      "name": "Ravi Kumar",
      "mobile": "+919876543210",
      "email": "ravi@example.com",
      "remarks": "Interested in the advertised apartment"
    }
  ]
}
```

| Field | Required | Description |
| --- | --- | --- |
| `name` | Yes | Customer name, up to 255 characters. |
| `mobile` | Yes | Indian mobile number; a +91 prefix is accepted and normalized. |
| `email` | No | Email address. Omitted, null or empty is accepted. |
| `remarks` | No | Enquiry message, up to 2,000 characters. Omitted, null or empty is accepted. |

[JSON schema](magicbricks.schema.json). No source ID, staff ID, property type, assignment or commission fields are needed. Unknown fields are ignored. Source is set internally to **Magic Bricks**, and new leads enter routing unassigned.

The smallest accepted payload is:

```json
{"leads":[{"name":"Ravi Kumar","mobile":"9876543210"}]}
```

## Response and duplicate behavior

HTTP 200 is returned only after the bulk-import transaction completes:

```json
{
  "success": true,
  "received": 1,
  "created": 1,
  "existing": 0
}
```

New leads enter the unassigned telecalling routing queue with source `Magic Bricks`. Indian country/trunk prefixes are normalized before matching existing phone numbers. Optional `remarks` is saved as the new lead's initial follow-up note.

A matching phone number reuses the existing lead and returns `existing: 1`. The existing lead's contact data, source, owner and follow-up schedule are preserved; a repeated push does not replace its remarks or create another lead. This minimal endpoint does not capture separate enquiries by unique portal enquiry ID.

- 400: invalid request or row. The entire request is rejected before insert.
- 401: missing or incorrect integration key.
- 413: request exceeds the body limit.
- 503: integration key is unset or the Magic Bricks source is inactive/missing.
- 5xx: processing failed; do not treat as accepted. Agree retry handling with the provider.

The response contains counts only, never customer records, internal assignee details or credentials.

## Deployment

1. Copy `crm-backend/migrations/087_add_magicbricks_lead_source.sql` to the deployment's `infra/migrations/` and run `docker compose run --rm --no-deps db-migrate` there.
2. Set `MAGICBRICKS_API_KEY` in the **CRM backend** environment using the supplied key. Do not put the key in source control, frontend settings, URLs or this document.
3. Deploy/recreate the CRM backend with that environment. Request logging redacts `X-API-Key`, authorization, website service key and cookie headers.
4. Send one agreed test lead with the correct key, check routing/source and the 200 acknowledgement, and verify the same request with an incorrect key returns 401.
5. Share the live URL, [JSON schema](magicbricks.schema.json), and the key through the agreed private channel. Confirm the provider can POST JSON and set `X-API-Key`; a different provider payload/auth format needs an adapter.

Production reads the key from `~/majestan/crm/.env` on the server.
