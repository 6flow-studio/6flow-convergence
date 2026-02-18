import GitHub from "@auth/core/providers/github";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

const githubProvider = GitHub({
  profile(profile) {
    return {
      id: profile.id.toString(),
      name: profile.name ?? profile.login,
      email: profile.email ?? undefined,
      image: profile.avatar_url,
    };
  },
});

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [githubProvider, Password],
});
