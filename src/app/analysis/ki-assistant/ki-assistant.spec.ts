import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ResourceService } from '../../services/resource.service';
import { KiAssistantComponent } from './ki-assistant';

describe('KiAssistantComponent', () => {
  let fixture: ComponentFixture<KiAssistantComponent>;
  let askAssistant: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    askAssistant = vi.fn().mockReturnValue(
      of({
        answer: '• Jackets nachkaufen',
        mode: 'gemini',
        model: 'gemini-3.8-flash',
        notice: '',
      }),
    );
    await TestBed.configureTestingModule({
      imports: [KiAssistantComponent],
      providers: [{ provide: ResourceService, useValue: { askAssistant } }],
    }).compileComponents();

    fixture = TestBed.createComponent(KiAssistantComponent);
    fixture.detectChanges();
  });

  function typeAndSend(text: string): void {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#assistant-question');
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  function messages(): string[] {
    return [...fixture.nativeElement.querySelectorAll('.assistant-message')].map(
      (item: HTMLElement) => item.textContent!.replace(/\s+/g, ' ').trim(),
    );
  }

  it('asks a suggested question and shows the Gemini answer', () => {
    fixture.nativeElement.querySelector('.assistant-suggestions button').click();
    fixture.detectChanges();

    expect(askAssistant).toHaveBeenCalledWith('Welche Kategorien verkaufen sich am besten?', []);
    expect(messages()).toEqual([
      'Welche Kategorien verkaufen sich am besten?',
      'Gemini • Jackets nachkaufen',
    ]);
  });

  it('sends the previous turns along for follow-up questions', () => {
    typeAndSend('Was verkauft sich gut?');
    typeAndSend('Und was sollen wir kaufen?');

    expect(askAssistant).toHaveBeenLastCalledWith('Und was sollen wir kaufen?', [
      { role: 'user', text: 'Was verkauft sich gut?' },
      { role: 'assistant', text: '• Jackets nachkaufen' },
    ]);
    expect(fixture.nativeElement.querySelector('#assistant-question').value).toBe('');
  });

  it('labels answers of the built-in analysis and shows the notice', () => {
    askAssistant.mockReturnValue(
      of({
        answer: 'Nachkaufen: Dresses',
        mode: 'basic',
        model: '',
        notice: 'Das kostenlose Gemini-Kontingent ist gerade aufgebraucht.',
      }),
    );

    typeAndSend('Was kaufen?');

    expect(messages()[1]).toContain('Basis-Analyse');
    expect(messages()[1]).toContain('Kontingent');
  });

  it('does not send empty questions', () => {
    typeAndSend('   ');

    expect(askAssistant).not.toHaveBeenCalled();
  });

  it('explains when the hourly question limit is reached', () => {
    askAssistant.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 429 })));

    typeAndSend('Top?');

    expect(fixture.nativeElement.textContent).toContain('Zu viele Fragen');
  });

  it('has the anchor the sidebar link points to', () => {
    expect(fixture.nativeElement.querySelector('#ki-assistant')).not.toBeNull();
  });
});
