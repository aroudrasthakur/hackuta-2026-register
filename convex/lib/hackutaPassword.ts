/**
 * Password provider based on @convex-dev/auth Password with a reuse check on reset.
 */
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import type { PasswordConfig } from "@convex-dev/auth/providers/Password";
import {
  createAccount,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
  signInViaProvider,
} from "@convex-dev/auth/server";
import type { GenericDataModel } from "convex/server";
import { Scrypt } from "lucia";
import { assertPasswordNotReused } from "./assertPasswordNotReused";

function validateDefaultPasswordRequirements(password: string) {
  if (!password || password.length < 8) {
    throw new Error("Invalid password");
  }
}

function defaultProfile(params: Record<string, unknown>) {
  return {
    email: params.email as string,
  };
}

export function HackutaPassword<DataModel extends GenericDataModel>(
  config: PasswordConfig<DataModel> = {},
) {
  const provider = config.id ?? "password";
  return ConvexCredentials<DataModel>({
    id: "password",
    authorize: async (params, ctx) => {
      const flow = params.flow as string;
      const passwordToValidate =
        flow === "signUp"
          ? (params.password as string)
          : flow === "reset-verification"
            ? (params.newPassword as string)
            : null;
      if (passwordToValidate !== null) {
        if (config.validatePasswordRequirements !== undefined) {
          config.validatePasswordRequirements(passwordToValidate);
        } else {
          validateDefaultPasswordRequirements(passwordToValidate);
        }
      }
      const profile = config.profile?.(params, ctx) ?? defaultProfile(params);
      const { email } = profile;
      const secret = params.password as string;

      if (flow === "signUp") {
        if (secret === undefined) {
          throw new Error("Missing `password` param for `signUp` flow");
        }
        const created = await createAccount(ctx, {
          provider,
          account: { id: email, secret },
          profile: profile as never,
          shouldLinkViaEmail: config.verify !== undefined,
          shouldLinkViaPhone: false,
        });
        const { account, user } = created;
        if (config.verify && !account.emailVerified) {
          return await signInViaProvider(ctx, config.verify, {
            accountId: account._id,
            params,
          });
        }
        return { userId: user._id };
      }

      if (flow === "signIn") {
        if (secret === undefined) {
          throw new Error("Missing `password` param for `signIn` flow");
        }
        const retrieved = await retrieveAccount(ctx, {
          provider,
          account: { id: email, secret },
        });
        if (retrieved === null) {
          throw new Error("Invalid credentials");
        }
        const { account, user } = retrieved;
        if (config.verify && !account.emailVerified) {
          return await signInViaProvider(ctx, config.verify, {
            accountId: account._id,
            params,
          });
        }
        return { userId: user._id };
      }

      if (flow === "reset") {
        if (!config.reset) {
          throw new Error(`Password reset is not enabled for ${provider}`);
        }
        const { account } = await retrieveAccount(ctx, {
          provider,
          account: { id: email },
        });
        return await signInViaProvider(ctx, config.reset, {
          accountId: account._id,
          params,
        });
      }

      if (flow === "reset-verification") {
        if (!config.reset) {
          throw new Error(`Password reset is not enabled for ${provider}`);
        }
        if (params.newPassword === undefined) {
          throw new Error("Missing `newPassword` param for `reset-verification` flow");
        }

        const newPassword = params.newPassword as string;
        await assertPasswordNotReused(ctx, provider, email, newPassword);

        const { account: resetAccount } = await retrieveAccount(ctx, {
          provider,
          account: { id: email },
        });
        const result = await signInViaProvider(ctx, config.reset, { params });
        if (result === null) {
          throw new Error("Invalid code");
        }
        const { userId, sessionId } = result;
        if (resetAccount.userId !== userId) {
          throw new Error("Invalid code");
        }

        await modifyAccountCredentials(ctx, {
          provider,
          account: { id: email, secret: newPassword },
        });
        await invalidateSessions(ctx, { userId, except: [sessionId] });
        return { userId, sessionId };
      }

      if (flow === "email-verification") {
        if (!config.verify) {
          throw new Error(`Email verification is not enabled for ${provider}`);
        }
        const { account } = await retrieveAccount(ctx, {
          provider,
          account: { id: email },
        });
        return await signInViaProvider(ctx, config.verify, {
          accountId: account._id,
          params,
        });
      }

      throw new Error(
        'Missing `flow` param, it must be one of "signUp", "signIn", "reset", "reset-verification" or "email-verification"!',
      );
    },
    crypto: {
      async hashSecret(password: string) {
        return await new Scrypt().hash(password);
      },
      async verifySecret(password: string, hash: string) {
        return await new Scrypt().verify(hash, password);
      },
    },
    extraProviders: [config.reset, config.verify],
    ...config,
  });
}
