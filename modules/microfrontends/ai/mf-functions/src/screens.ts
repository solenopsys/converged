import { defineScreens } from "front-core";
import { $screen } from "./domain";
import { FunctionsListView } from "./views/FunctionsListView";


export const SCREENS = defineScreens([
  {
    id: "functions.list",
    when: $screen,
    is: "list",
    view: FunctionsListView,
    surface: "center",
    title: "Функции",
  },
]);
