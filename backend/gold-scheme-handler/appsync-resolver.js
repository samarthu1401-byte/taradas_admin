import { util } from "@aws-appsync/utils";

export function request(ctx) {
  return {
    operation: "Invoke",
    payload: {
      arguments: ctx.args,
      info: {
        fieldName: ctx.info.fieldName,
        parentTypeName: ctx.info.parentTypeName,
      },
      identity: ctx.identity,
    },
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return ctx.result;
}
