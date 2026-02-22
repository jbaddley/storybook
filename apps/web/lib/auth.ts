import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from './prisma';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user: authUser, account }) {
      if (account?.provider !== 'google' || !authUser.email || !authUser.id)
        return false;
      const dbUser = await prisma.user.upsert({
        where: { googleId: authUser.id },
        update: {
          email: authUser.email,
          name: authUser.name ?? null,
          picture: authUser.image ?? null,
        },
        create: {
          email: authUser.email,
          name: authUser.name ?? null,
          googleId: authUser.id,
          picture: authUser.image ?? null,
        },
      });
      (authUser as { dbUserId?: string }).dbUserId = dbUser.id;
      return true;
    },
    async jwt({ token, user }) {
      if (user && (user as { dbUserId?: string }).dbUserId) {
        token.userId = (user as { dbUserId: string }).dbUserId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.userId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
    error: '/auth/error',
  },
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
};
