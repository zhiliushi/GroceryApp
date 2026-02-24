"""
Generic Finite State Machine engine.

Declarative state/transition definitions with guard conditions,
action callbacks, and audit trail. AI-ready: external systems
can call attempt_transition() to drive state changes.
"""

import time
import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass
class Transition:
    """A possible transition between states."""
    from_state: str
    to_state: str
    trigger: str
    guard: Optional[Callable[[Dict[str, Any]], bool]] = None
    action: Optional[Callable[[Dict[str, Any]], None]] = None
    description: str = ""


@dataclass
class AuditEntry:
    """Record of a state transition."""
    from_state: str
    to_state: str
    trigger: str
    actor_id: str
    timestamp: float
    context: Dict[str, Any] = field(default_factory=dict)


class StateMachine:
    """
    Generic FSM that can be applied to any entity.

    Example:
        fsm = StateMachine(
            name="review",
            states=["pending", "approved", "rejected"],
            initial_state="pending",
            transitions=[
                Transition("pending", "approved", "approve"),
                Transition("pending", "rejected", "reject"),
            ],
        )
        success, new_state, error = fsm.attempt_transition("pending", "approve", "admin1")
    """

    def __init__(
        self,
        name: str,
        states: List[str],
        initial_state: str,
        transitions: List[Transition],
    ):
        self.name = name
        self.states = set(states)
        self.initial_state = initial_state
        self.transitions = transitions
        self._audit_log: List[AuditEntry] = []

        self._transition_map: Dict[Tuple[str, str], List[Transition]] = {}
        for t in transitions:
            key = (t.from_state, t.trigger)
            self._transition_map.setdefault(key, []).append(t)

    def get_available_triggers(self, current_state: str) -> List[str]:
        """Return all valid triggers from the current state."""
        triggers = set()
        for (from_state, trigger) in self._transition_map:
            if from_state == current_state:
                triggers.add(trigger)
        return sorted(triggers)

    def attempt_transition(
        self,
        current_state: str,
        trigger: str,
        actor_id: str = "system",
        context: Optional[Dict[str, Any]] = None,
    ) -> Tuple[bool, str, Optional[str]]:
        """
        Attempt a state transition.
        Returns: (success, new_state_or_current, error_message_or_none)
        """
        context = context or {}
        key = (current_state, trigger)
        candidates = self._transition_map.get(key, [])

        if not candidates:
            return False, current_state, f"No transition '{trigger}' from state '{current_state}'"

        for transition in candidates:
            if transition.guard and not transition.guard(context):
                continue

            if transition.action:
                try:
                    transition.action(context)
                except Exception as e:
                    logger.error("FSM action failed: %s", e)
                    return False, current_state, f"Action failed: {e}"

            entry = AuditEntry(
                from_state=current_state,
                to_state=transition.to_state,
                trigger=trigger,
                actor_id=actor_id,
                timestamp=time.time(),
                context=context,
            )
            self._audit_log.append(entry)

            logger.info(
                "FSM[%s]: %s --%s--> %s (actor=%s)",
                self.name, current_state, trigger, transition.to_state, actor_id,
            )
            return True, transition.to_state, None

        return False, current_state, f"Guard conditions not met for trigger '{trigger}'"

    def get_audit_log(self) -> List[AuditEntry]:
        return list(self._audit_log)

    def get_state_diagram(self) -> Dict[str, List[Dict[str, str]]]:
        """Serializable representation of the state machine."""
        diagram: Dict[str, List[Dict[str, str]]] = {}
        for state in self.states:
            diagram[state] = []
            for t in self.transitions:
                if t.from_state == state:
                    diagram[state].append({
                        "trigger": t.trigger,
                        "to": t.to_state,
                        "description": t.description,
                    })
        return diagram
