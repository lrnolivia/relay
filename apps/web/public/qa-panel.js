import { loadingMarkup } from "./loading.js";
import { iconSlot, hydrateProjectIcons } from "./project-icons.js";
import { projectName } from "./operator-projects.js";

export function qaEscape(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char];
  });
}

function answerLabel(value) {
  if (value === "yes") return "Yes, clear";
  if (value === "no") return "No, needs work";
  return "Not sure";
}

function surfaceSize(evidence = {}) {
  const width = Math.max(320, Math.min(3840, Number(evidence.viewport?.width) || 1440));
  const height = Math.max(240, Math.min(2160, Number(evidence.viewport?.height) || 900));
  return { width, height };
}

export function renderQaPreview(stage, state, requestedMode) {
  const preview = stage.querySelector(".qa-preview");
  const live = state.live || {};
  const evidence = state.evidence || {};
  const canLive = Boolean(live.active && live.embeddable && live.url && !live.renderUnconfirmed);
  const retained=live.retained||{},canRetained=Boolean(retained.available&&retained.url);
  const canVideo = Boolean(evidence.video_url);
  const mode =
    requestedMode === "retained" && canRetained ? "retained" :
    requestedMode === "live" && canLive ? "live" :
    requestedMode === "video" && canVideo ? "video" :
    requestedMode === "captured" ? "captured" :
    canVideo ? "video" : "captured";
  const { width, height } = surfaceSize(evidence);

  let media = "";
  if(mode==='retained') {
    const entry=state.retainedNav?.entry||evidence.dom?.retained_preview?.entry||'app';
    const route=state.retainedNav?.hash||evidence.dom?.retained_preview?.hash||(entry==='inspector'?'#review':'#/today');
    const url=new URL(retained.url,location.origin);url.searchParams.set('entry',entry==='inspector'?'inspector':'app');url.hash=String(route).slice(0,1000);
    media='<iframe class="qa-surface-media" src="'+qaEscape(url.href)+'" title="Retained interactive preview using sample data" sandbox="allow-scripts" data-qa-live-preview data-qa-retained-preview></iframe>';
  } else if (mode === "live") {
    media = '<iframe class="qa-surface-media" src="' + qaEscape(live.url) + '" title="Live QA preview" data-qa-live-preview></iframe>';
  } else if (mode === "video") {
    media = '<video class="qa-surface-media" src="' + qaEscape(evidence.video_url) + '" controls playsinline preload="metadata" aria-label="Recorded QA evidence"></video>';
  } else {
    media = loadingMarkup("preview", "Loading captured image") +
      '<img class="qa-surface-media qa-image-pending" src="' + qaEscape(evidence.screenshot_url) + '" alt="Exact captured QA evidence">';
  }

  preview.innerHTML =
    '<div class="qa-camera"><div class="qa-surface" data-qa-surface-kind="' + mode +
    '" style="width:' + width + 'px;height:' + height + 'px">' + media +
    '</div></div><div class="qa-gesture-layer" aria-hidden="true"></div>';

  if (mode === "captured") {
    const image = preview.querySelector("img");
    const finish = () => {
      preview.querySelector(".content-skeleton")?.remove();
      image.classList.remove("qa-image-pending");
      if (!image.naturalWidth) preview.innerHTML = '<div class="qa-surface-error">The captured image could not load.</div>';
    };
    image.addEventListener("load", finish, { once: true });
    image.addEventListener("error", finish, { once: true });
    if (image.complete) finish();
  }
  return mode;
}

export function renderQaPanel(stage, state, questionIndex, handlers) {
  const panel = stage.querySelector(".qa-companion");
  const evidence = state.evidence || {};
  const context = evidence.context || {};
  const review = state.review || { answers: {}, notes: "", overall: null };
  const questions = state.questions || [];
  const q = questions[questionIndex] || null;
  const answer = q ? review.answers?.[q.id] : null;
  const progress = q ? "Review " + (questionIndex + 1) + " of " + questions.length : "Review";

  const allAnswered = questions.every(question => ["yes", "no", "not_sure"].includes(review.answers?.[question.id]));
  const guidance = state.noteParts?.guidance;
  const guidanceQuestions = guidance?.questions?.map(item => typeof item === "string" ? item : item.prompt || item.question || "").filter(Boolean) || [];
  panel.innerHTML =
    '<div class="qa-review-head">' +
      '<div class="qa-review-progress"><span class="qa-review-dot" aria-hidden="true"></span><span>' + qaEscape(progress) + '</span></div>' +
      (context.project ? '<span class="qa-project-pill">' + iconSlot(context.project) +
        '<strong>' + qaEscape(projectName(context.project)) + '</strong></span>' : "") +
    '</div>' +
    '<div class="qa-question-content"><section class="qa-question-card">' +
      '<h2 class="qa-question">' + qaEscape(q?.prompt || "Anything feel off?") + '</h2>' +
      '<p class="qa-question-reason">' + qaEscape(q?.reason || "Leave a note if there is anything you want changed.") + '</p>' +
      (q ? '<div class="qa-answer-stack" role="group" aria-label="Answer">' +
        ["yes", "no", "not_sure"].map(function (value) {
          return '<button type="button" class="qa-answer ' + (answer === value ? "selected" : "") +
            '" aria-pressed="' + (answer === value) + '" data-qa-answer="' + value + '">' + answerLabel(value) + '</button>';
        }).join("") + '</div>' : "") +
    '</section>' +
    (guidance ? '<details class="qa-guidance"><summary>Earlier review guidance</summary><p>This was prepared by an agent. Your notes are separate; the original packet is retained.</p><ul>' + guidanceQuestions.map(item => '<li>' + qaEscape(item) + '</li>').join('') + '</ul></details>' : '') +
    '<div class="qa-feedback"><span class="qa-save-state" data-qa-save-state role="status" aria-live="polite"></span><button type="button" data-qa-retry hidden>Retry save</button></div>' +
    '</div><nav class="qa-question-nav" aria-label="Review questions"><button type="button" data-qa-notes-open aria-haspopup="dialog" aria-controls="qa-notes-dialog">Notes</button><button type="button" data-qa-previous ' + (questionIndex === 0 ? 'disabled' : '') + '>Back</button>' +
    (questionIndex < questions.length - 1 ? '<button type="button" data-qa-next>Next</button>' : '<button type="button" data-qa-finish ' + (!allAnswered ? 'disabled' : '') + '>Finish</button>') + '</nav>';


  const retained=state.live?.retained;
  if(retained){
    const section=document.createElement('section');section.className='qa-retained-review';
    section.innerHTML='<p style="font-size:12px;line-height:1.4;margin:10px 0">Retained '+qaEscape(retained.source_sha.slice(0,7))+' · sample data. '+qaEscape(retained.state==='pending'?'Kept pending approval. Approval starts a 30-day review window.':retained.state==='expired'?'Review window ended. Reopen to restore this copy.':'Available until '+new Date(retained.expires_at).toLocaleDateString()+'.')+'</p><button type="button" class="qa-answer" style="width:100%;min-height:44px;font-size:13px" data-retained-review '+(state.retainedBusy?'disabled':'')+'>'+(state.retainedBusy?'Saving…':retained.state==='pending'?'Approve this build':'Reopen build review')+'</button>';
    panel.append(section);section.querySelector('button').addEventListener('click',()=>handlers.retained?.());
  }
  void hydrateProjectIcons(panel);
  if (q) {
    panel.querySelectorAll("[data-qa-answer]").forEach(function (button) {
      button.addEventListener("click", function () { handlers.answer(q.id, button.dataset.qaAnswer); });
    });
  }
  panel.querySelector('[data-qa-previous]')?.addEventListener('click', () => handlers.navigate(-1));
  panel.querySelector('[data-qa-next]')?.addEventListener('click', () => handlers.navigate(1));
  panel.querySelector('[data-qa-finish]')?.addEventListener('click', () => handlers.finish());
  panel.querySelector('[data-qa-retry]')?.addEventListener('click', () => handlers.retry());
  stage.querySelector('.qa-notes-popout')?.remove();
  const notes = document.createElement('dialog');
  notes.id = 'qa-notes-dialog';
  notes.className = 'qa-notes-popout';
  notes.setAttribute('aria-labelledby', 'qa-notes-title');
  notes.innerHTML = '<div class="qa-notes-head"><h2 id="qa-notes-title">Your notes</h2><button type="button" data-qa-notes-close>Done</button></div>' +
    '<label class="qa-notes"><span class="sr-only">Your notes</span><textarea maxlength="' + Math.max(0,6000 - (state.noteParts?.prefix?.length || 0) - (state.noteParts?.prefix ? 16 : 0)) + '" placeholder="Add a note…">' +
    qaEscape(state.humanNotes ?? review.notes ?? '') + '</textarea></label>' +
    '<div class="qa-feedback"><span class="qa-save-state" data-qa-save-state role="status" aria-live="polite"></span><button type="button" data-qa-retry hidden>Retry save</button></div>';
  stage.append(notes);
  const notesButton = panel.querySelector('[data-qa-notes-open]');
  const closeNotes = () => { notes.close(); notesButton.focus(); };
  notesButton.addEventListener('click', () => { notes.showModal(); notes.querySelector('textarea').focus(); });
  notes.querySelector('[data-qa-notes-close]').addEventListener('click', closeNotes);
  notes.querySelector('[data-qa-retry]').addEventListener('click', () => handlers.retry());
  // Keep keyboard focus inside the popout; Escape closes only notes,
  // without exiting the surrounding Inspector review.
  notes.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); closeNotes(); }
    if (event.key === 'Tab') {
      const controls = Array.from(notes.querySelectorAll('button,textarea')).filter(node => !node.hidden && !node.disabled);
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
    }
  });
  notes.addEventListener('cancel', event => { event.preventDefault(); closeNotes(); });
  const textarea = notes.querySelector('textarea');
  textarea.addEventListener('input', () => handlers.notes(textarea.value));
}

