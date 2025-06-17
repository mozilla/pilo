import { GenericLogger } from "spark";

type EventSender = (event: string, data: any) => Promise<void>;

/**
 * Logger that forwards all Spark events to a Server-Sent Events stream
 * Uses the GenericLogger for automatic event forwarding
 */
export class StreamLogger extends GenericLogger {
  constructor(sendEvent: EventSender) {
    super(async (eventType: string, data: any) => {
      await sendEvent(eventType, data);
    });
  }
}
