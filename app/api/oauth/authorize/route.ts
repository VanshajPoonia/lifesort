import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { checkAuthorizeRequest, createCode, withParams } from "@/lib/oauth-server"
import { originOf } from "@/lib/oauth"

// POST: the consent form on /oauth/authorize. Allow sends the app a one-time code;
// Cancel sends access_denied. Only accepts posts from our own pages.
export async function POST(request: Request) {
  const origin = originOf(request)
  if (request.headers.get("origin") !== origin) {
    return new NextResponse("This form only works from LifeSort.", { status: 403 })
  }

  const form = await request.formData()
  const field = (name: string) => {
    const value = form.get(name)
    return typeof value === "string" ? value : undefined
  }
  const check = await checkAuthorizeRequest({
    client_id: field("client_id"),
    redirect_uri: field("redirect_uri"),
    state: field("state"),
    code_challenge: field("code_challenge"),
    code_challenge_method: "S256",
    response_type: "code",
  })
  if ("fatal" in check) return new NextResponse(check.fatal, { status: 400 })
  if ("sendBack" in check) {
    const { redirectUri, error, description, state } = check.sendBack
    return NextResponse.redirect(withParams(redirectUri, { error, error_description: description, state }), 303)
  }

  const user = await getUserFromSession()
  if (!user) return NextResponse.redirect(new URL("/login", origin), 303)

  const { client, redirectUri, state, challenge } = check.ok
  if (field("decision") !== "allow") {
    return NextResponse.redirect(withParams(redirectUri, { error: "access_denied", state, iss: origin }), 303)
  }
  const code = await createCode({ userId: user.id, clientId: client.client_id, redirectUri, challenge })
  return NextResponse.redirect(withParams(redirectUri, { code, state, iss: origin }), 303)
}
