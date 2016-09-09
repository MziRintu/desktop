import * as React from 'react'
import { ipcRenderer, remote } from 'electron'

import { Resizable } from './resizable'
import RepositoriesList from './repositories-list'
import { default as RepositoryView } from './repository'
import NotLoggedIn from './not-logged-in'
import { WindowControls } from './window/window-controls'
import { Dispatcher, AppStore, CloningRepository } from '../lib/dispatcher'
import Repository from '../models/repository'
import { MenuEvent } from '../main-process/menu'
import fatalError from '../lib/fatal-error'
import { IAppState, RepositorySection, PopupType, SelectionType } from '../lib/app-state'
import Popuppy from './popuppy'
import CreateBranch from './create-branch'
import Branches from './branches'
import AddRepository from './add-repository'
import RenameBranch from './rename-branch'
import DeleteBranch from './delete-branch'
import PublishRepository from './publish-repository'
import { default as CloningRepositoryView } from './cloning-repository'
import { showPopupAppMenu, setMenuEnabled } from './main-process-proxy'

interface IAppProps {
  readonly dispatcher: Dispatcher
  readonly appStore: AppStore
}

export default class App extends React.Component<IAppProps, IAppState> {
  public constructor(props: IAppProps) {
    super(props)

    this.state = props.appStore.getState()
    props.appStore.onDidUpdate(state => {
      this.setState(state)

      const selectedState = state.selectedState
      let haveBranch = false
      if (selectedState && selectedState.type === SelectionType.Repository) {
        const currentBranch = selectedState.state.branchesState.currentBranch
        const defaultBranch = selectedState.state.branchesState.defaultBranch
        // If we are:
        //  1. on the default branch, or
        //  2. on an unborn branch, or
        //  3. on a detached HEAD
        // there's not much we can do.
        if (!currentBranch || !defaultBranch || currentBranch.name === defaultBranch.name) {
          haveBranch = false
        } else {
          haveBranch = true
        }
      }

      setMenuEnabled('rename-branch', haveBranch)
      setMenuEnabled('delete-branch', haveBranch)
    })

    ipcRenderer.on('menu-event', (event: Electron.IpcRendererEvent, { name }: { name: MenuEvent }) => {
      this.onMenuEvent(name)
    })
  }

  private onMenuEvent(name: MenuEvent): any {
    switch (name) {
      case 'push': return this.push()
      case 'pull': return this.pull()
      case 'select-changes': return this.selectChanges()
      case 'select-history': return this.selectHistory()
      case 'add-local-repository': return this.showFileBrowser()
      case 'create-branch': return this.createBranch()
      case 'show-branches': return this.showBranches()
      case 'remove-repository': return this.removeRepository()
      case 'add-repository': return this.addRepository()
      case 'rename-branch': return this.renameBranch()
      case 'delete-branch': return this.deleteBranch()
    }

    return fatalError(`Unknown menu event name: ${name}`)
  }

  private renameBranch() {
    const state = this.state.selectedState
    if (!state || state.type !== SelectionType.Repository) { return }

    const branch = state.state.branchesState.currentBranch
    if (!branch) { return }

    this.props.dispatcher.showPopup({
      type: PopupType.RenameBranch,
      repository: state.repository,
      branch,
    })
  }

  private deleteBranch() {
    const state = this.state.selectedState
    if (!state || state.type !== SelectionType.Repository) { return }

    const branch = state.state.branchesState.currentBranch
    if (!branch) { return }

    this.props.dispatcher.showPopup({
      type: PopupType.DeleteBranch,
      repository: state.repository,
      branch,
    })
  }

  private addRepository() {
    this.props.dispatcher.showPopup({
      type: PopupType.AddRepository,
    })
  }

  private createBranch() {
    const state = this.state.selectedState
    if (!state || state.type !== SelectionType.Repository) { return }

    this.props.dispatcher.showPopup({
      type: PopupType.CreateBranch,
      repository: state.repository,
    })
  }

  private showBranches() {
    const state = this.state.selectedState
    if (!state || state.type !== SelectionType.Repository) { return }

    this.props.dispatcher.showPopup({
      type: PopupType.ShowBranches,
      repository: state.repository,
    })
  }

  private selectChanges() {
    const state = this.state.selectedState
    if (!state || state.type !== SelectionType.Repository) { return }

    this.props.dispatcher.changeRepositorySection(state.repository, RepositorySection.Changes)
  }

  private selectHistory() {
    const state = this.state.selectedState
    if (!state || state.type !== SelectionType.Repository) { return }

    this.props.dispatcher.changeRepositorySection(state.repository, RepositorySection.History)
  }

  private push() {
    const state = this.state.selectedState
    if (!state || state.type !== SelectionType.Repository) { return }

    this.props.dispatcher.push(state.repository)
  }

  private async pull() {
    const state = this.state.selectedState
    if (!state || state.type !== SelectionType.Repository) { return }

    this.props.dispatcher.pull(state.repository)
  }

  public componentDidMount() {
    document.ondragover = document.ondrop = (e) => {
      e.preventDefault()
    }

    document.body.ondrop = (e) => {
      const files = e.dataTransfer.files
      this.handleDragAndDrop(files)
      e.preventDefault()
    }
  }

  private handleDragAndDrop(fileList: FileList) {
    const paths: string[] = []
    for (let i = 0; i < fileList.length; i++) {
      const path = fileList[i]
      paths.push(path.path)
    }

    this.addRepositories(paths)
  }

  private showFileBrowser() {
    const directories = remote.dialog.
        showOpenDialog({ properties: [ 'openDirectory', 'multiSelections' ] })
    if (directories && directories.length > 0) {
      this.addRepositories(directories)
    }
  }

  private removeRepository() {
    const state = this.state.selectedState
    if (!state) { return }

    this.props.dispatcher.removeRepositories([ state.repository ])
  }

  private addRepositories(paths: string[]) {
    this.props.dispatcher.addRepositories(paths)
  }

  private renderTitlebar() {
    if (process.platform !== 'darwin' && process.platform !== 'win32') {
      return null
    }

    const winControls = process.platform === 'win32'
      ? <WindowControls />
      : null

    return (
      <div id='desktop-app-title-bar'>
        <span className='app-title'>GitHub Desktop</span>
        {winControls}
      </div>
    )
  }

  /** Put the main application menu into a context menu for now (win only) */
  private onContextMenu(e: React.MouseEvent<any>) {
    if (process.platform === 'win32') {
      e.preventDefault()
      showPopupAppMenu()
    }
  }

  private currentPopupContent(): JSX.Element | null {
    const popup = this.state.currentPopup
    if (!popup) { return null }

    if (popup.type === PopupType.CreateBranch) {
      const repository = popup.repository
      const state = this.props.appStore.getRepositoryState(repository)
      return <CreateBranch repository={repository}
                           dispatcher={this.props.dispatcher}
                           branches={state.branchesState.allBranches}
                           currentBranch={state.branchesState.currentBranch}/>
    } else if (popup.type === PopupType.ShowBranches) {
      const repository = popup.repository
      const state = this.props.appStore.getRepositoryState(repository)
      return <Branches allBranches={state.branchesState.allBranches}
                       recentBranches={state.branchesState.recentBranches}
                       currentBranch={state.branchesState.currentBranch}
                       defaultBranch={state.branchesState.defaultBranch}
                       dispatcher={this.props.dispatcher}
                       repository={popup.repository}
                       commits={state.commits}/>
    } else if (popup.type === PopupType.AddRepository) {
      return <AddRepository dispatcher={this.props.dispatcher}/>
    } else if (popup.type === PopupType.RenameBranch) {
      return <RenameBranch dispatcher={this.props.dispatcher}
                           repository={popup.repository}
                           branch={popup.branch}/>
    } else if (popup.type === PopupType.DeleteBranch) {
      return <DeleteBranch dispatcher={this.props.dispatcher}
                           repository={popup.repository}
                           branch={popup.branch}/>
    } else if (popup.type === PopupType.PublishRepository) {
      return <PublishRepository repository={popup.repository}
                                dispatcher={this.props.dispatcher}
                                users={this.state.users}/>
    }

    return fatalError(`Unknown popup type: ${popup}`)
  }

  private renderPopup(): JSX.Element | null {
    const content = this.currentPopupContent()
    if (!content) { return null }

    return <Popuppy>{content}</Popuppy>
  }

  private renderErrors() {
    const errors = this.state.errors
    if (!errors.length) { return null }

    const clearErrors = () => {
      for (const error of errors) {
        this.props.dispatcher.clearError(error)
      }
    }

    const msgs = errors.map(e => e.message)
    return (
      <Popuppy>
        <div>{msgs.map(msg => <span>{msg}</span>)}</div>
        <button onClick={clearErrors}>OK</button>
      </Popuppy>
    )
  }

  private renderApp() {
    const selectedRepository = this.state.selectedState ? this.state.selectedState.repository : null
    return (
      <div id='desktop-app-contents' onContextMenu={e => this.onContextMenu(e)}>
        <Resizable id='desktop-app-sidebar' configKey='repositories-list-width'>
          <RepositoriesList selectedRepository={selectedRepository}
                            onSelectionChanged={repository => this.onSelectionChanged(repository)}
                            dispatcher={this.props.dispatcher}
                            repositories={this.state.repositories}
                            loading={this.state.loading}/>
        </Resizable>

        {this.renderRepository()}

        {this.renderPopup()}

        {this.renderErrors()}
      </div>
    )
  }

  private renderRepository() {
    const selectedState = this.state.selectedState
    if (!selectedState) {
      return <NoRepositorySelected/>
    }

    if (selectedState.type === SelectionType.Repository) {
      return (
        <RepositoryView repository={selectedState.repository}
                        state={selectedState.state}
                        dispatcher={this.props.dispatcher}
                        emoji={this.state.emoji}/>
      )
    } else if (selectedState.type === SelectionType.CloningRepository) {
      return <CloningRepositoryView repository={selectedState.repository}
                                    state={selectedState.state}/>
    } else {
      return fatalError(`Unknown state: ${selectedState}`)
    }
  }

  private renderNotLoggedIn() {
    return (
      <div id='desktop-app-contents'>
        <NotLoggedIn dispatcher={this.props.dispatcher}/>
      </div>
    )
  }

  public render() {
    return (
      <div id='desktop-app-chrome'>
        {this.renderTitlebar()}
        {this.state.users.length > 0 ? this.renderApp() : this.renderNotLoggedIn()}
      </div>
    )
  }

  private onSelectionChanged(repository: Repository | CloningRepository) {
    this.props.dispatcher.selectRepository(repository)

    if (repository instanceof Repository) {
      this.props.dispatcher.refreshGitHubRepositoryInfo(repository)
    }
  }
}

function NoRepositorySelected() {
  return (
    <div className='panel blankslate'>
      No repository selected
    </div>
  )
}