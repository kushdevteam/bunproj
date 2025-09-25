//! You can see image of the state machine at /img/state_machine.gif

use std::{
    fmt::{Display, Formatter},
    io::Write,
    ops::ControlFlow,
};

use dptree::prelude::*;

#[tokio::main]
async fn main() {
    let state = CommandState::Inactive;

    let dispatcher = dptree::entry()
        .branch(active_handler())
        .branch(paused_handler())
        .branch(inactive_handler())
        .branch(exit_handler());

    repl(state, dispatcher).await
}

async fn repl(mut state: CommandState, dispatcher: Handler<'static, Store, CommandState>) {
    loop {
        println!("|| Current state is {}", state);
        print!(">> ");
        std::io::stdout().flush().unwrap();

        let mut cmd = String::new();
        std::io::stdin().read_line(&mut cmd).unwrap();

        let str = cmd.trim();
        let event = Event::parse(str);

        let new_state = match event {
            Some(event) => match dispatcher.dispatch(dptree::deps![event, state.clone()]).await {
                ControlFlow::Break(new_state) => new_state,
                ControlFlow::Continue(_) => {
                    println!("There is no transition for the event");
                    continue;
                }
            },
            _ => {
                println!("Unknown event");
                continue;
            }
        };

        if new_state == CommandState::Exit {
            return;
        }

        state = new_state;
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CommandState {
    Active,
    Paused,
    Inactive,
    Exit,
}

impl Display for CommandState {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result<(), std::fmt::Error> {
        match self {
            CommandState::Active => f.write_str("Active"),
            CommandState::Paused => f.write_str("Paused"),
            CommandState::Inactive => f.write_str("Inactive"),
            CommandState::Exit => f.write_str("Exit"),
        }
    }
}

#[derive(Debug, Clone)]
pub enum Event {
    Begin,
    Pause,
    Resume,
    End,
    Exit,
}

impl Event {
    fn parse(input: &str) -> Option<Self> {
        match input {
            "begin" => Some(Event::Begin),
            "pause" => Some(Event::Pause),
            "resume" => Some(Event::Resume),
            "end" => Some(Event::End),
            "exit" => Some(Event::Exit),
            _ => None,
        }
    }
}

type Store = dptree::di::DependencyMap;
type Transition = Endpoint<'static, Store, TransitionOut>;
type TransitionOut = CommandState;

mod transitions {
    use super::*;

    pub fn begin() -> Transition {
        dptree::case![Event::Begin].endpoint(|| async { CommandState::Active })
    }

    pub fn pause() -> Transition {
        dptree::case![Event::Pause].endpoint(|| async { CommandState::Paused })
    }

    pub fn end() -> Transition {
        dptree::case![Event::End].endpoint(|| async { CommandState::Inactive })
    }

    pub fn resume() -> Transition {
        dptree::case![Event::Resume].endpoint(|| async { CommandState::Active })
    }

    pub fn exit() -> Transition {
        dptree::case![Event::Exit].endpoint(|| async { CommandState::Exit })
    }
}

type FsmHandler = Handler<'static, Store, TransitionOut>;

fn active_handler() -> FsmHandler {
    dptree::case![CommandState::Active].branch(transitions::pause()).branch(transitions::end())
}

fn paused_handler() -> FsmHandler {
    dptree::case![CommandState::Paused].branch(transitions::resume()).branch(transitions::end())
}

fn inactive_handler() -> FsmHandler {
    dptree::case![CommandState::Inactive].branch(transitions::begin()).branch(transitions::exit())
}

fn exit_handler() -> FsmHandler {
    dptree::case![CommandState::Exit].branch(transitions::exit())
}
