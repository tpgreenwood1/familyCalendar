import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { familyGroupId: number } & DefaultSession["user"];
  }
  interface User {
    familyGroupId: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    familyGroupId: number;
  }
}
