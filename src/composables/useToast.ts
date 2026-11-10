import { ref } from "vue";

const message = ref("");
let timer: number | undefined;

export function useToast() {
  function notify(text: string): void {
    message.value = text;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      message.value = "";
    }, 2200);
  }

  return { message, notify };
}
