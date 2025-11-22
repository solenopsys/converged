/* IMPORT */

import useScheduler from "./use_scheduler";
import type { Disposer, ObservableMaybe } from "../types";

/* MAIN */

const useAnimationFrame = (
	callback: ObservableMaybe<FrameRequestCallback>,
): Disposer => {
	return useScheduler({
		callback,
		once: true,
		cancel: cancelAnimationFrame,
		schedule: requestAnimationFrame,
	});
};

/* EXPORT */

export default useAnimationFrame;
