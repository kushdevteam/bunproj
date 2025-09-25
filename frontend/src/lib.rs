use leptos::*;
use leptos_meta::*;
use leptos_router::*;

mod components;
mod api;

use components::{WalletTable, WalletGenerator};
use bnb_bundler_shared::*;

#[component]
pub fn App() -> impl IntoView {
    // Provides context that manages the app's metadata
    provide_meta_context();

    view! {
        <Html lang="en"/>
        <Title text="BNB Chain Multi-Wallet Bundler"/>
        <Meta charset="utf-8"/>
        <Meta name="viewport" content="width=device-width, initial-scale=1"/>
        
        <Link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"/>
        
        <Style>
            {include_str!("../styles/main.css")}
        </Style>

        <Router>
            <div class="app-container">
                <Sidebar/>
                <main class="main-content">
                    <Routes>
                        <Route path="" view=DashboardPage/>
                        <Route path="/bundler" view=BundlerPage/>
                    </Routes>
                </main>
            </div>
        </Router>
    }
}

#[component]
fn Sidebar() -> impl IntoView {
    view! {
        <aside class="sidebar">
            <div class="logo">
                <i class="fas fa-rocket"></i>
                <h1>"BNB Bundler"</h1>
                <span class="version">"v1.0"</span>
            </div>

            <div class="search-bar">
                <i class="fas fa-search"></i>
                <input type="text" placeholder="Search"/>
                <span class="shortcut">"⌘K"</span>
            </div>

            <nav>
                <div class="nav-section">
                    <A class="nav-item" href="">
                        <i class="fas fa-chart-bar"></i>
                        <span>"Dashboard"</span>
                    </A>
                    <A class="nav-item" href="/bundler">
                        <i class="fas fa-layer-group"></i>
                        <span>"Bundler"</span>
                    </A>
                </div>

                <div class="nav-section">
                    <h3>"Features"</h3>
                    <div class="nav-item">
                        <i class="fas fa-wallet"></i>
                        <span>"Wallets"</span>
                        <span class="badge">"0"</span>
                    </div>
                    <div class="nav-item">
                        <i class="fas fa-shield-alt"></i>
                        <span>"Security"</span>
                        <span class="status">"Active"</span>
                    </div>
                </div>
            </nav>
        </aside>
    }
}

#[component]
fn DashboardPage() -> impl IntoView {
    let (health_status, set_health_status) = create_signal(None::<HealthResponse>);
    
    // Check health status on mount
    create_effect(move |_| {
        spawn_local(async move {
            match api::get_health().await {
                Ok(response) => {
                    if response.success {
                        set_health_status(response.data);
                    }
                },
                Err(e) => {
                    logging::error!("Failed to get health status: {}", e);
                }
            }
        });
    });

    view! {
        <header class="page-header">
            <h1 class="page-title">"Dashboard"</h1>
            <div class="status-indicators">
                <div class="status-dot"></div>
                <span>
                    {move || match health_status() {
                        Some(health) => health.status,
                        None => "Connecting...".to_string()
                    }}
                </span>
            </div>
        </header>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">"0"</div>
                <div class="stat-label">"Wallets Generated"</div>
            </div>
            <div class="stat-card">
                <div class="stat-value green">"0.0 BNB"</div>
                <div class="stat-label">"Total Balance"</div>
            </div>
            <div class="stat-card">
                <div class="stat-value orange">"0"</div>
                <div class="stat-label">"Transactions"</div>
            </div>
        </div>

        <div class="dashboard-content">
            <div class="network-info">
                <h3>"Network Information"</h3>
                {move || match health_status() {
                    Some(health) => view! {
                        <div class="network-details">
                            <p><strong>"Network: "</strong>{health.network}</p>
                            <p><strong>"Server: "</strong>{health.server}</p>
                            {health.block_number.map(|block| view! {
                                <p><strong>"Block Number: "</strong>{block.to_string()}</p>
                            })}
                            {health.gas_price_gwei.map(|gas| view! {
                                <p><strong>"Gas Price: "</strong>{gas.to_string()}" gwei"</p>
                            })}
                        </div>
                    }.into_view(),
                    None => view! {
                        <p>"Loading network information..."</p>
                    }.into_view()
                }}
            </div>
        </div>
    }
}

#[component]
fn BundlerPage() -> impl IntoView {
    view! {
        <header class="page-header">
            <h1 class="page-title">"Multi-Wallet Bundler"</h1>
        </header>

        <div class="bundler-grid">
            <div class="bundler-card">
                <WalletGenerator/>
            </div>
            <div class="bundler-card">
                <WalletTable/>
            </div>
        </div>
    }
}

#[wasm_bindgen::prelude::wasm_bindgen(start)]
pub fn main() {
    console_error_panic_hook::set_once();
    mount_to_body(|| view! { <App/> })
}