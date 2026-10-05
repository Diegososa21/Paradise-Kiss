import { HttpErrorResponse } from '@angular/common/http';
import { afterNextRender, Component, ElementRef, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { AssistantAnswer, AssistantTurn } from '../../models/resource.model';
import { ResourceService } from '../../services/resource.service';

interface ChatMessage extends AssistantTurn {
  mode?: AssistantAnswer['mode'];
  notice?: string;
}

/** Chat that answers questions about best sellers and purchase tips. */
@Component({
  selector: 'app-ki-assistant',
  standalone: true,
  templateUrl: './ki-assistant.html',
  styleUrl: './ki-assistant.scss',
})
export class KiAssistantComponent {
  private readonly resourceService = inject(ResourceService);
  private readonly element: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly route = inject(ActivatedRoute, { optional: true });

  protected readonly suggestions = [
    'Welche Kategorien verkaufen sich am besten?',
    'Was sollten wir als Nächstes einkaufen?',
    'Wie entwickelt sich der Umsatz?',
  ];
  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly question = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  constructor() {
    // Opened via the sidebar link "KI-Assistent": scroll to the chat and focus the input.
    // The chart above loads first, so this runs once the assistant is actually rendered.
    afterNextRender(() => {
      if (this.route?.snapshot.fragment !== 'ki-assistant') return;
      const host = this.element.nativeElement;
      host.scrollIntoView({ behavior: 'smooth', block: 'start' });
      host.querySelector<HTMLInputElement>('#assistant-question')?.focus({ preventScroll: true });
    });
  }

  protected updateQuestion(event: Event): void {
    this.question.set((event.target as HTMLInputElement).value);
  }

  protected submit(event?: Event): void {
    event?.preventDefault();
    this.ask(this.question());
  }

  protected ask(text: string): void {
    const question = text.trim();
    if (!question || this.loading()) return;

    const history: AssistantTurn[] = this.messages().map(({ role, text }) => ({ role, text }));
    this.messages.update((messages) => [...messages, { role: 'user', text: question }]);
    this.question.set('');
    this.error.set('');
    this.loading.set(true);

    this.resourceService
      .askAssistant(question, history)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (reply) =>
          this.messages.update((messages) => [
            ...messages,
            { role: 'assistant', text: reply.answer, mode: reply.mode, notice: reply.notice },
          ]),
        error: (error: unknown) => {
          this.error.set(
            error instanceof HttpErrorResponse && error.status === 429
              ? 'Zu viele Fragen in kurzer Zeit. Bitte etwas später erneut versuchen.'
              : 'Der KI-Assistent ist gerade nicht erreichbar.',
          );
        },
      });
  }

  protected clear(): void {
    this.messages.set([]);
    this.error.set('');
  }
}
