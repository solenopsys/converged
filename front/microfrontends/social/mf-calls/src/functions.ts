export const openTrackEvent = createEvent<{ trackId?: string }>();

const OpenTrackAction: Action = {
    id: "player.open_track",
    description: "Открыть трек в плеере",
    invoke: ({ trackId }) => {
        openTrackEvent({ trackId });
        present(PlayerWidget);
    }
};

const ShowPlayerAction: Action = {
    id: "player.show",
    description: "Показать плеер",
    invoke: () => {
        present(PlayerWidget);
    }
};


// Widgets
const PlayerWidget: Widget<typeof Player> = {
    view: Player,
    placement: (ctx) => "right",
    mount: () => {
        // Initialization logic if needed
    },
    commands: {
        play: (trackData) => {
            // Handle play command
        },
        pause: () => {
            // Handle pause command
        },
        stop: () => {
            // Handle stop command
        },
        volumeChange: (volume) => {
            // Handle volume change
        }
    }
};
