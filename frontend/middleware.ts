import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isPublicRoute = createRouteMatcher(["/login"]);

export default convexAuthNextjsMiddleware((request, { convexAuth }) => {
  if (!isPublicRoute(request) && !convexAuth.isAuthenticated()) {
    return nextjsMiddlewareRedirect(request, "/login");
  }
  if (isPublicRoute(request) && convexAuth.isAuthenticated()) {
    return nextjsMiddlewareRedirect(request, "/dashboard");
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
