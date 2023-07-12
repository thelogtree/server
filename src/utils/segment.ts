import Segment from "analytics-node";
import { config } from "./config";

const MySegment = new Segment(config.segment.writeKey);

export enum SegmentEventsEnum {
  Searched = "Searched",
  InviteAccepted = "Invite Accepted",
  NewOrganizationCreated = "New Organization Created",
  InteractionWithIntercomCanvas = "Interaction With Intercom Canvas",
}

export const SegmentUtil = {
  track: (eventName: SegmentEventsEnum, userId: string, properties?: any) =>
    config.environment.isProd
      ? MySegment.track({
          event: eventName as unknown as string,
          userId,
          properties,
        })
      : {},
};
